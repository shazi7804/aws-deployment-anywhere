import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import * as aws from './../.gen/providers/aws';

export interface AwsDeploymentProps {
  readonly region: string;
}

export class AwsDeploymentStack extends TerraformStack {
  constructor(scope: Construct, name: string, props: AwsDeploymentProps) {
    super(scope, name);

    const region = props.region

    const current = new aws.datasources.DataAwsCallerIdentity(this, 'current');

    const artifact = new aws.s3.S3Bucket(this, 'artifact', {
        bucket: 'aws-deployment-anywhere-artifact-' + region + '-' + current.accountId,
    })

    new aws.s3.S3BucketAcl(this, 'acl', {
      bucket: artifact.id as string,
      acl: 'private'
    })

    const ecr = new aws.ecr.EcrRepository(this, 'image', {
      name: 'aws-deployment-anywhere',
    })

    const repo = new aws.codecommit.CodecommitRepository(this, 'repo', {
      repositoryName: 'aws-deployment-anywhere',
      description: 'Deploy to anywhere targets'
    });

    const buildRole = new aws.iam.IamRole(this, 'iam-build-role', {
      assumeRolePolicy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [{
              Effect: "Allow",
              Principal: {
                  Service: "codebuild.amazonaws.com"
              },
              Action: "sts:AssumeRole",
              Sid: ""
          }]
      })
    });

    const buildPolicy = new aws.iam.IamPolicy(this, 'iam-build-policy', {
      description: 'Sample policy to allow codebuild to execute buildspec and create by cdktf',
      policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
              {
                  Effect: "Allow",
                  Action: [
                      "sts:GetServiceBearerToken",
                      "ecr-public:*",
                      "ecr:GetAuthorizationToken",
                      "ecr:InitiateLayerUpload",
                      "ecr:UploadLayerPart",
                      "ecr:CompleteLayerUpload",
                      "ecr:BatchCheckLayerAvailability",
                      "ecr:PutImage",
                      'ecr:GetAuthorizationToken',
                      "logs:CreateLogGroup",
                      "logs:CreateLogStream",
                      "logs:PutLogEvents",
                      "ssm:GetParameters"
                  ],
                  Resource: "*"
              },
              {
                  Effect: "Allow",
                  Action: [
                      's3:GetObject',
                      's3:GetObjectVersion',
                      's3:PutObject'
                  ],
                  Resource: [
                    artifact.arn + '/*',
                    'arn:aws:s3:::aws-deployment-anywhere-store-' + region + '-' + current.accountId
                  ]
              }
          ]
      })
    });

    new aws.iam.IamRolePolicyAttachment(this, 'build-attach-policy', {
      role: buildRole.name as string,
      policyArn: buildPolicy.arn
    });

    const build = new aws.codebuild.CodebuildProject(this, 'build', {
      name: 'aws-deployment-anywhere',
      environment: {
        computeType: 'BUILD_GENERAL1_SMALL',
        type: 'LINUX_CONTAINER',
        image: 'aws/codebuild/amazonlinux2-x86_64-standard:3.0',
        imagePullCredentialsType: 'CODEBUILD',
        privilegedMode: true,
        environmentVariable: [
          {
            name: 'AWS_ACCOUNT_ID',
            value: current.accountId
          },
          {
            name: 'AWS_DEFAULT_REGION',
            value: region
          },
          {
            name: 'IMAGE_URI',
            value: ecr.repositoryUrl
          }
        ]
      },
      serviceRole: buildRole.arn as string,
      source: { type: 'CODEPIPELINE' },
      sourceVersion: 'master',
      artifacts: { type: 'CODEPIPELINE' }
    });

    const pipelineRole = new aws.iam.IamRole(this, 'iam-pipeline-role', {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {
                Service: "codepipeline.amazonaws.com"
            },
            Action: "sts:AssumeRole",
            Sid: ""
        }]
      })
    });



    const pipelinePolicy = new aws.iam.IamPolicy(this, 'iam-pipeline-policy', {
      description: 'Sample policy to allow codepipeline to execute and create by cdktf',
      policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
              {
                  Effect: "Allow",
                  Action: [
                      "codecommit:GetBranch",
                      "codecommit:GetCommit",
                      "codecommit:UploadArchive",
                      "codecommit:GetUploadArchiveStatus",      
                      "codecommit:CancelUploadArchive",
                      "codecommit:BatchGet*",
                      "codecommit:BatchDescribe*",
                      "codecommit:Describe*",
                      "codecommit:EvaluatePullRequestApprovalRules",
                      "codecommit:Get*",
                      "codecommit:List*",
                      "codecommit:GitPull",
                      "codecommit:UploadArchive",
                  ],
                  Resource: "*"
              },
              {
                  Effect: "Allow",
                  Action: [
                      's3:GetObject',
                      's3:GetObjectVersion',
                      's3:PutObject'
                  ],
                  Resource: artifact.arn + '/*'
              },
              {
                Effect: "Allow",
                Action: [
                    "codebuild:BatchGetBuilds",
                    "codebuild:StartBuild"
                ],
                Resource: '*'
            }
          ]
      })
    });

    new aws.iam.IamRolePolicyAttachment(this, 'pipeline-attach-policy', {
      role: pipelineRole.name as string,
      policyArn: pipelinePolicy.arn
    });

    new aws.codepipeline.Codepipeline(this, 'pipeline', {
      name: 'aws-deployment-anywhere',
      roleArn: pipelineRole.arn as string,
      artifactStore: [{
          location: artifact.bucket as string,
          type: 'S3'
      }],
      stage: [
        {
          name: 'Source',
          action: [{
              name: 'Source',
              category: 'Source',
              owner: 'AWS',
              provider: 'CodeCommit',
              version: '1',
              outputArtifacts: ["SourceOutput"],
              configuration: {
                RepositoryName: repo.repositoryName,
                BranchName: 'master'
              }
          }]
        },
        {
          name: 'Build',
          action: [{
              name: 'Build',
              category: 'Build',
              owner: 'AWS',
              provider: 'CodeBuild',
              version: '1',
              inputArtifacts: ["SourceOutput"],
              outputArtifacts: ["BuildOutput"],
              configuration: {
                ProjectName: build.name
              }
          }]
        }
      ]
    });



  }
}
