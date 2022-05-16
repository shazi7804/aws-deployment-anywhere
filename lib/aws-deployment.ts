import { Construct } from "constructs";
import { Resource } from "cdktf";
import {
  datasources,
  s3,
  ecr,
  iam,
  codecommit,
  codebuild,
  codedeploy,
  codepipeline,
} from './../.gen/providers/aws';

export interface AwsDeploymentProps {
  readonly region: string;
}

export class AwsDeploymentStack extends Resource {
  constructor(scope: Construct, name: string, props: AwsDeploymentProps) {
    super(scope, name);

    const region = props.region

    const current = new datasources.DataAwsCallerIdentity(this, 'current');

    const artifact = new s3.S3Bucket(this, 'artifact', {
        bucket: 'aws-deployment-anywhere-artifact-' + region + '-' + current.accountId,
    })

    new s3.S3BucketAcl(this, 'acl', {
      bucket: artifact.id as string,
      acl: 'private'
    })

    const registry = new ecr.EcrRepository(this, 'registry', {
      name: 'aws-deployment-anywhere',
    })

    const repo = new codecommit.CodecommitRepository(this, 'repo', {
      repositoryName: 'aws-deployment-anywhere',
      description: 'Deploy to anywhere targets'
    });

    const buildRole = new iam.IamRole(this, 'iam-build-role', {
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

    const buildPolicy = new iam.IamPolicy(this, 'iam-build-policy', {
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
                      's3:PutObject',
                      's3:HeadObject'
                  ],
                  Resource: [
                    artifact.arn + '/*',
                    'arn:aws:s3:::aws-deployment-anywhere-store-' + region + '-' + current.accountId + '/*'
                  ]
              }
          ]
      })
    });

    new iam.IamRolePolicyAttachment(this, 'build-attach-policy', {
      role: buildRole.name as string,
      policyArn: buildPolicy.arn
    });

    const build = new codebuild.CodebuildProject(this, 'build', {
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
            value: registry.repositoryUrl
          }
        ]
      },
      serviceRole: buildRole.arn as string,
      source: { type: 'CODEPIPELINE' },
      sourceVersion: 'master',
      artifacts: { type: 'CODEPIPELINE' }
    });

    // CodeDeploy
    const codedeployRole = new iam.IamRole(this, 'iam-codedeploy-role', {
      assumeRolePolicy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [{
              Effect: "Allow",
              Principal: {
                  Service: "codedeploy.amazonaws.com"
              },
              Action: "sts:AssumeRole",
              Sid: ""
          }]
      })
    });

    new iam.IamRolePolicyAttachment(this, 'codedeploy-attach-policy', {
      role: codedeployRole.name as string,
      policyArn: 'arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole'
    });


    const codedeployApp = new codedeploy.CodedeployApp(this, 'codedeploy-app', {
      name: 'aws-deployment-anywhere'
    })

    const codedeployGroup = new codedeploy.CodedeployDeploymentGroup(this, 'codedeploy-group', {
      appName: codedeployApp.name,
      deploymentGroupName: 'master',
      serviceRoleArn: codedeployRole.arn,
      ec2TagFilter: [{
        key: 'Name',
        type: 'KEY_AND_VALUE',
        value: 'Anywhere-EC2'
      }]
    })

    const deployAks = new codebuild.CodebuildProject(this, 'deploy-aks', {
      name: 'aws-deployment-aks',
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
          }
        ]
      },
      serviceRole: buildRole.arn as string,
      source: {
        type: 'CODEPIPELINE',
        buildspec: "buildspec.yml"
      },
      artifacts: { type: 'CODEPIPELINE' }
    });

    const pipelineRole = new iam.IamRole(this, 'iam-pipeline-role', {
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



    const pipelinePolicy = new iam.IamPolicy(this, 'iam-pipeline-policy', {
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
                      "codedeploy:*"
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

    new iam.IamRolePolicyAttachment(this, 'pipeline-attach-policy', {
      role: pipelineRole.name as string,
      policyArn: pipelinePolicy.arn
    });

    new codepipeline.Codepipeline(this, 'pipeline', {
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
        },
        {
          name: 'Deploy',
          action: [
            {
              name: 'Deploy-EC2',
              category: 'Deploy',
              owner: 'AWS',
              provider: 'CodeDeploy',
              version: '1',
              inputArtifacts: ["BuildOutput"],
              configuration: {
                ApplicationName: codedeployApp.name,
                DeploymentGroupName: codedeployGroup.deploymentGroupName
              },
              runOrder: 1
            },            
            {
              name: 'Deploy-Azure-Kubernetes',
              category: 'Build',
              owner: 'AWS',
              provider: 'CodeBuild',
              version: '1',
              inputArtifacts: ["BuildOutput"],
              outputArtifacts: ["dummy"],
              configuration: {
                ProjectName: deployAks.name
              }
            },

          ]
        }
      ]
    });



  }
}
