import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { createDynamoDBDocumentClient } from "../lambda-layer/utility";

const ddbDocClient = createDynamoDBDocumentClient();
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("Event: ", event);

        // Extract reviewerName and movieId from path parameters
        const { reviewerName, movieId } = event.pathParameters || {};

        // Extract language from query string parameters
        const language = event.queryStringParameters?.language;

        if (!reviewerName || !movieId) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing reviewerName or movieId" }),
            };
        }

        const getItemOutput = await ddbDocClient.send(new GetItemCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                "ReviewerName": { S: reviewerName },
                "MovieId": { N: movieId },
            },
        }));
        console.log('output', getItemOutput)

        if (!getItemOutput.Item) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "No review found for given reviewerName and movieId" }),
            };
        }

        const movieReview = getItemOutput.Item.Content?.S;
        // const translateParams = {
        //     Text: movieReview,
        //     SourceLanguageCode: 'en',
        //     TargetLanguageCode: language
        // };
        // const translateCommand = new TranslateTextCommand(translateParams);
        // const translatedResult = await translateClient.send(translateCommand);

        const translatedContent = await translateContent(movieReview, language);
        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                data: {
                    ...getItemOutput.Item,
                    Content: translatedContent,
                },
            }),
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

// function for translation logic
async function translateContent(content, targetLanguage) {
    const commandOutput = await translateClient.send(new TranslateTextCommand({
        Text: content,
        SourceLanguageCode: "en", //English is the default
        TargetLanguageCode: targetLanguage,
    }));

    return commandOutput.TranslatedText;
}
