import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
const ddbDocClient = createDynamoDBDocumentClient();
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {     // Note change
    try {
        console.log("Event: ", event);
        const parameters = event?.pathParameters;
        const MovieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const reviewerNameOrYear = parameters?.ReviewerNameOrYear ? parameters.ReviewerNameOrYear : undefined;

        if (!MovieId) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "Missing movie Id" }),
            };
        }
        var commandOutput: any;
        const params: QueryCommandInput = {
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "MovieId = :MovieId",
            ExpressionAttributeValues: {
                ":MovieId": MovieId
            }
        };
        params.ExpressionAttributeValues ??= {}

        if (reviewerNameOrYear) {
            if (!isNaN(Number(reviewerNameOrYear))) {
                params.FilterExpression = "begins_with(ReviewDate, :year)";
                params.ExpressionAttributeValues[":year"] = reviewerNameOrYear;
            } else {
                params.KeyConditionExpression += " AND ReviewerName = :reviewerName";
                params.ExpressionAttributeValues[":reviewerName"] = reviewerNameOrYear;
            }
        }
        commandOutput = await ddbDocClient.send(new QueryCommand(params));
        console.log('output', commandOutput)

        if (!commandOutput.Items || commandOutput.Items.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "No movie reviews found for given conditions" }),
            };
        }
        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ data: commandOutput.Items }),
        };
    } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error }),
        };
    }
};

function createDynamoDBDocumentClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
} 