import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createDynamoDBDocumentClient } from "../lambda-layer/utility";

const ddbDocClient = createDynamoDBDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        // Print Event
        console.log("Event: ", event);

        // Get request parameters
        const { movieId, ReviewerNameOrYear } = event.pathParameters || {}; // Extract from path parameters
        const ReviewerName = ReviewerNameOrYear;

        const updateContent = event.body ? JSON.parse(event.body).Content : undefined; // Extract update content

        // Validate parameters
        if (!movieId || !ReviewerName) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing MovieId or ReviewerName" }),
            };
        }

        if (!updateContent) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing content to update" }),
            };
        }
        if (typeof ReviewerName !== 'string') {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "ReviewerName must be a string" }),
            };
        }

        const params = {
            TableName: process.env.TABLE_NAME,
            Key: {
                MovieId: parseInt(movieId), // Ensure MovieId is a number
                ReviewerName,
            },
            UpdateExpression: "SET Content = :content",
            ExpressionAttributeValues: {
                ":content": updateContent,
            },

        };

        const commandOutput = await ddbDocClient.send(new UpdateCommand(params));
        console.log('output', commandOutput)

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Movie review updated" }),
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

