import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

import { Construct } from 'constructs';
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/movieReviews";

type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
};

export class AppApi extends Construct {
  constructor(scope: Construct, id: string, props: AppApiProps) {
    super(scope, id);

    const appApi = new apig.RestApi(this, "AppApi", {
      description: "App RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    const movieReviewsTable = new dynamodb.Table(this, "MoviesReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "MovieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'ReviewerName', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MoviesReviews"
    });

    movieReviewsTable.addGlobalSecondaryIndex({
      indexName: 'ReviewerIndex',
      partitionKey: { name: 'ReviewerName', type: dynamodb.AttributeType.STRING },
      sortKey: { name: "MovieId", type: dynamodb.AttributeType.NUMBER },
    });

    const getReviewsByIdOrRatingFn = new lambdanode.NodejsFunction(
      this,
      "GetReviewsFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getReviewsByIdOrRating.ts`,
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

    const getReviewsByNameAndYearFn = new lambdanode.NodejsFunction(
      this,
      "GetReviewsByNameAndYearFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getReviewsByNameAndYear.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );
    const updateReviewsByNameFn = new lambdanode.NodejsFunction(
      this,
      "UpdateReviewsByNameFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/updateReview.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );
    const getAllReviewsByNameFn = new lambdanode.NodejsFunction(
      this,
      "GetAllReviewsByNameFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getAllReviewsByName.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );
    const getTranslatedReviewsFn = new lambdanode.NodejsFunction(
      this,
      "GetTranslatedReviewsFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getTranslatedReview.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );
    getTranslatedReviewsFn.role?.attachInlinePolicy(new iam.Policy(this, 'TranslateTextPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: ['translate:TranslateText'],
          resources: ['*'],
        }),
      ],
    }));

    new custom.AwsCustomResource(this, "movieReviewsDdbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("movieReviewsDdbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    //Permissions
    movieReviewsTable.grantReadData(getReviewsByIdOrRatingFn)
    movieReviewsTable.grantReadWriteData(newMovieReviewFn)
    movieReviewsTable.grantReadData(getReviewsByNameAndYearFn)
    movieReviewsTable.grantReadWriteData(updateReviewsByNameFn)
    movieReviewsTable.grantReadData(getAllReviewsByNameFn)
    movieReviewsTable.grantReadData(getTranslatedReviewsFn)

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
    const moviesReviewEndpoint = moviesEndpoint.addResource("reviews");
    const reviewsByNameAndYear = movieReviewsEndpoint.addResource("{ReviewerNameOrYear}");
    const reviewsEnd = api.root.addResource("reviews");
    const moviesByReviewer = reviewsEnd.addResource("{reviewerName}")
    const moviesByReviewerEnd = moviesByReviewer.addResource("{movieId}");
    const translatedReviews = moviesByReviewerEnd.addResource("{translation}");

    //for protected API's which are POST and PUT
    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/authorizer.ts",
    });
    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );

    moviesReviewEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn, { proxy: true },), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    }
    );
    reviewsByNameAndYear.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateReviewsByNameFn, { proxy: true }), {
      authorizer: requestAuthorizer,
      authorizationType: apig.AuthorizationType.CUSTOM,
    }
    )
    movieReviewsEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getReviewsByIdOrRatingFn, { proxy: true })
    );
    reviewsByNameAndYear.addMethod(
      "GET",
      new apig.LambdaIntegration(getReviewsByNameAndYearFn, { proxy: true })
    )
    moviesByReviewer.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllReviewsByNameFn, { proxy: true })
    );
    translatedReviews.addMethod(
      "GET",
      new apig.LambdaIntegration(getTranslatedReviewsFn, { proxy: true })
    )
  }
}
