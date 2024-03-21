import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class DataStack extends cdk.Stack {
    public readonly table: dynamodb.Table;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.table = new dynamodb.Table(this, "MoviesReviewsTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: { name: "MovieId", type: dynamodb.AttributeType.NUMBER },
            sortKey: { name: 'ReviewerName', type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "MoviesReviews"
        });

        this.table.addGlobalSecondaryIndex({
            indexName: 'ReviewerIndex',
            partitionKey: { name: 'ReviewerName', type: dynamodb.AttributeType.STRING },
            sortKey: { name: "MovieId", type: dynamodb.AttributeType.NUMBER },
        });
    }
}