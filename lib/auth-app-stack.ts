import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApi } from './auth-api'
import { AppApi } from './app-api'
import { DataStack } from "./data-stack";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

// This Stack class creates the Cognito user pool and a client for the pool - 
// these are framework L2 constructs. It then instantiates instances of our custom L2 constructs, 
// effectively delegating the creation of all the other stack resources to our constructs.
export class AuthAppStack extends cdk.Stack {

    constructor(scope: Construct, id: string, dataStack: dynamodb.Table, props?: cdk.StackProps) {
        super(scope, id, props);

        const userPool = new UserPool(this, "UserPool", {
            signInAliases: { username: true, email: true },
            selfSignUpEnabled: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const userPoolId = userPool.userPoolId;

        const appClient = userPool.addClient("AppClient", {
            authFlows: { userPassword: true },
        });
        const userPoolClientId = appClient.userPoolClientId;

        new AuthApi(this, 'AuthServiceApi', {
            userPoolId: userPoolId,
            userPoolClientId: userPoolClientId,
        });
        new AppApi(this, 'AppApi', {
            userPoolId: userPoolId,
            userPoolClientId: userPoolClientId,
            dynamoDbTable: dataStack, // Pass DynamoDB table as a prop
        });
    }

}