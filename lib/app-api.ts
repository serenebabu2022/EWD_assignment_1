import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from 'path';

import { Construct } from 'constructs';
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/movieReviews";

type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
  dynamoDbTable: dynamodb.Table // Recieving DynamoDB table name as a prop
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
    // Define the directory containing your layer code
    const layerCodeDirectory = path.resolve(__dirname, '..', 'lambda-layer');
    // Create the Lambda layer
    const lambdaLayer = new lambda.LayerVersion(this, 'LambdaLayer', {
      code: lambda.Code.fromAsset(layerCodeDirectory), // Provide the directory containing your layer code
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X], // Specify the runtime(s) compatible with your layer
      description: 'Lambda layer', // Optionally provide a description
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
          TABLE_NAME: props.dynamoDbTable.tableName,
          REGION: 'eu-west-1',
        },
        layers: [lambdaLayer]
      }
    );

    const newMovieReviewFn = new lambdanode.NodejsFunction(this, "AddMovieReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addMovieReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: props.dynamoDbTable.tableName,
        REGION: "eu-west-1",
      },
      layers: [lambdaLayer]
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
          TABLE_NAME: props.dynamoDbTable.tableName,
          REGION: "eu-west-1",
        },
        layers: [lambdaLayer]
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
          TABLE_NAME: props.dynamoDbTable.tableName,
          REGION: "eu-west-1",
        },
        layers: [lambdaLayer]
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
          TABLE_NAME: props.dynamoDbTable.tableName,
          REGION: "eu-west-1",
        },
        layers: [lambdaLayer]
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
          TABLE_NAME: props.dynamoDbTable.tableName,
          REGION: "eu-west-1",
        },
        layers: [lambdaLayer]
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

    new custom.AwsCustomResource(this, "moviesReviewsDdbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [props.dynamoDbTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesReviewsDdbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [props.dynamoDbTable.tableArn],
      }),
    });

    //Permissions
    props.dynamoDbTable.grantReadData(getReviewsByIdOrRatingFn)
    props.dynamoDbTable.grantReadWriteData(newMovieReviewFn)
    props.dynamoDbTable.grantReadData(getReviewsByNameAndYearFn)
    props.dynamoDbTable.grantReadWriteData(updateReviewsByNameFn)
    props.dynamoDbTable.grantReadData(getAllReviewsByNameFn)
    props.dynamoDbTable.grantReadData(getTranslatedReviewsFn)

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