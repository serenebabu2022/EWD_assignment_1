import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apig from "aws-cdk-lib/aws-apigateway";

import { Construct } from 'constructs';
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/movieReviews";

export class ServerlessBasicAssignmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const movieReviewsTable = new dynamodb.Table(this, "MoviesReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MoviesReviews",
    });

    // Define the Global Secondary Index (GSI)
    movieReviewsTable.addGlobalSecondaryIndex({
      indexName: 'MovieReviewsByMovieId', // GSI name
      partitionKey: { name: 'MovieId', type: dynamodb.AttributeType.NUMBER }, // GSI partition key
    });

    const getReviewsByMovieIdFn = new lambdanode.NodejsFunction(
      this,
      "GetReviewsByMovieIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getReviewsByMovieId.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const newMovieReviewFn = new lambdanode.NodejsFunction(this, "AddMovieReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addMovieReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: movieReviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    //Permissions
    movieReviewsTable.grantReadData(getReviewsByMovieIdFn)
    movieReviewsTable.grantReadWriteData(newMovieReviewFn)

    // REST API 
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });
    const moviesEndpoint = api.root.addResource("movies");
    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    const movieReviewsEndpoint = movieEndpoint.addResource("reviews");
    movieReviewsEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getReviewsByMovieIdFn, { proxy: true })
    );
    const moviesReviewEndpoint = moviesEndpoint.addResource("reviews");
    moviesReviewEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn, { proxy: true })
    )
  }
}
