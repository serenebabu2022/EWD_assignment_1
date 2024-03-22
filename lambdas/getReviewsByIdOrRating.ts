import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createDynamoDBDocumentClient } from "../lambda-layer/utility";

const ddbDocClient = createDynamoDBDocumentClient();
export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {     // Note change
    try {
        console.log("Event: ", event);
        const parameters = event?.pathParameters;
        const MovieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;

        const queryStringParameters = event?.queryStringParameters;
        const minRating = queryStringParameters?.minRating ? parseInt(queryStringParameters.minRating) : undefined
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
        if (minRating !== undefined) {
            // Retrieve movie reviews with the same MovieId and rating greater than minRating
            commandOutput = await ddbDocClient.send(
                new QueryCommand({
                    TableName: process.env.TABLE_NAME,
                    KeyConditionExpression: "MovieId = :MovieId",
                    FilterExpression: "Rating > :minRating",
                    ExpressionAttributeValues: {
                        ":MovieId": MovieId,
                        ":minRating": minRating,
                    },
                })
            );
        } else {

            // Retrieve all movie reviews with the same MovieId
            commandOutput = await ddbDocClient.send(
                new QueryCommand({
                    TableName: process.env.TABLE_NAME,
                    KeyConditionExpression: "MovieId = :MovieId",
                    ExpressionAttributeValues: {
                        ":MovieId": MovieId,
                    },
                })
            );
        }
        if (!commandOutput.Items || commandOutput.Items.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "No movie reviews found for given MovieId" }),
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