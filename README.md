

## Deployment Steps
###  Step 1. Install Terraform and CDK on Terraform

- Install Terraform (MacOS)

```
$ brew tap hashicorp/tap
$ brew install hashicorp/tap/terraform
$ terraform version
```

- Install cdktf

```bash
$ npm install -g cdktf-cli
$ cdktf --version
```

###  Step 2. Create an execution plan

```bash
$ cdktf get
$ cdktf plan
```

###  Step 3. Deploy the changes configuration

```bash
$ cdktf deploy
```

###  Step 4. Deploy source code

```
$ git clone https://git-codecommit.us-east-1.amazonaws.com/v1/repos/aws-deployment-anywhere
$ cd aws-deployment-anywhere
$ cp -R ../backend/* .
$ git add . && git commit -am "initial commit" && git push origin master
```
