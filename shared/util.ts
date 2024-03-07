import { marshall } from "@aws-sdk/util-dynamodb";
import { MovieReviews } from "./types";

export const generateMovieReviewItem = (movieReviews: MovieReviews) => {
    return {
        PutRequest: {
            Item: marshall(movieReviews),
        },
    };
};

export const generateBatch = (data: MovieReviews[]) => {
    return data.map((e) => {
        return generateMovieReviewItem(e);
    });
};
