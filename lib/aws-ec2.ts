import { Construct } from "constructs";
import { Resource } from "cdktf";
import {
  AwsProvider,
  ec2,
  vpc,
  iam
} from '../.gen/providers/aws';

export interface AwsEc2Props {
  readonly region: string;
}

export class AwsEc2Stack extends Resource {
  constructor(scope: Construct, name: string, props: AwsEc2Props) {
    super(scope, name);

    const region = props.region

    new AwsProvider(this, 'aws', { region });

    const awsVpc = new vpc.Vpc(this, 'vpc', {
      cidrBlock: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
    })

    const vpcId = awsVpc.id as string

    const igw = new vpc.InternetGateway(this, 'igw', { vpcId })

    const subnet = new vpc.Subnet(this, 'subnet', {
      cidrBlock: '10.0.1.0/24',
      availabilityZone: 'us-east-1a',
      vpcId,
    });

    const routeTable = new vpc.RouteTable(this, 'route-table', { vpcId })

    new vpc.RouteTableAssociation(this, 'route-subnet', {
      subnetId: subnet.id,
      routeTableId: routeTable.id
    })

    new vpc.Route(this, 'route', {
      routeTableId: routeTable.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: igw.id,
    })

    const role = new iam.IamRole(this, 'role', {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Effect: "Allow",
            Principal: {
                Service: "ec2.amazonaws.com"
            },
            Action: "sts:AssumeRole",
            Sid: ""
        }]
      })
    })

    new iam.IamRolePolicyAttachment(this, 'ec2-policy-codedeploy', {
      role: role.name,
      policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforAWSCodeDeploy'
    });
  
    new iam.IamRolePolicyAttachment(this, 'ec2-policy-ssm', {
      role: role.name,
      policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
    });

    const instanceProfile = new iam.IamInstanceProfile(this, 'instance-profile', {
      name: 'aws-deployment-anywhere-ec2-web',
      role: role.name
    });

    const securityGroup = new vpc.SecurityGroup(this, 'sg', {
      name: 'aws-deployment-anywhere-ec2-web',
      vpcId,
      egress: [{
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ["0.0.0.0/0"]
      }],
      ingress: [{
          fromPort: 80,
          toPort: 80,
          protocol: 'tcp',
          cidrBlocks: ["0.0.0.0/0"]
      }]
    })

    new ec2.Instance(this, 'instance', {
      ami: 'ami-033b95fb8079dc481',
      instanceType: 't3.micro',
      subnetId: subnet.id,
      iamInstanceProfile: instanceProfile.name,
      securityGroups: [securityGroup.id],
      associatePublicIpAddress: true,
      userData: `
      #!/bin/bash
      sudo yum update -y
      sudo amazon-linux-extras install -y lamp-mariadb10.2-php7.2 php7.2
      sudo yum install httpd ruby jq wget -y
      sudo chkconfig httpd on
      sudo service httpd start
      cd /tmp/
      wget https://aws-codedeploy-${region}.s3.amazonaws.com/latest/install
      chmod +x ./install
      ./install auto
      rm -f /tmp/install
      sudo chkconfig codedeploy-agent on
      sudo service codedeploy-agent start
      `,
      tags: {
        'Name': 'Anywhere-EC2'
      }
    })




  }
}
