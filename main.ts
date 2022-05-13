import { Construct } from "constructs";
import { App, TerraformStack, RemoteBackend } from "cdktf";
import * as aws from './.gen/providers/aws';
import { AwsDeploymentStack } from './lib/aws-deployment';

import * as az from '../.gen/providers/azurerm';

class AwsDeploymentAnywhereStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new aws.AwsProvider(this, 'aws', {
      region: 'us-east-1'
    });

    new AwsDeploymentStack(this, 'aws-deployment', {
      region: 'us-east-1'
    })

    new az.AzurermProvider(this, 'azure');

    new

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
