import { Construct } from "constructs";
import { App, TerraformStack, RemoteBackend } from "cdktf";
import { AwsDeploymentStack } from './lib/aws-deployment';
import { AwsEc2Stack } from './lib/aws-ec2';
import { AzureKubernetesStack } from './lib/azure-kubernetes';


class AwsDeploymentAnywhereStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsEc2Stack(this, 'aws-ec2', {
      region: 'us-east-1'
    })

    new AzureKubernetesStack(this, 'azure-kubernetes', {
      region: 'eastus'
    })

    new AwsDeploymentStack(this, 'aws-deployment', {
      region: 'us-east-1'
    })


  }
}

const app = new App();
const stack = new AwsDeploymentAnywhereStack(app, "aws-deployment-anywhere");
new RemoteBackend(stack, {
  hostname: "app.terraform.io",
  organization: "shazi7804",
  workspaces: {
    name: "aws-deployment-anywhere"
  }
});
app.synth();
