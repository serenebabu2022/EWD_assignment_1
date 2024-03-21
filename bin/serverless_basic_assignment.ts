#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthAppStack } from '../lib/auth-app-stack';
import { DataStack } from '../lib/data-stack';

const app = new cdk.App();
const dynamoDBStack = new DataStack(app, 'DynamoDBStack', {
  env: { account: '975050144303', region: 'eu-west-1' }
});

new AuthAppStack(app, 'AuthAppStack', dynamoDBStack.table, {
  env: { account: '975050144303', region: 'eu-west-1' }
});