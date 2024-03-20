import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerEvent,
    PolicyDocument,
    APIGatewayProxyEvent,
} from "aws-lambda";

import axios from "axios"
import jwt from 'jsonwebtoken'
import jwkToPem from "jwk-to-pem";

export type CookieMap = { [key: string]: string } | undefined;
export type JwtToken = { sub: string; email: string } | null;
export type Jwk = {
    keys: {
        alg: string;
        e: string;
        kid: string;
        kty: string;
        n: string;
        use: string;
    }[];
};

//function to Parse HTTP Cookies Request header’s string value and stores the result in a Map data structure for easy processing.
export const parseCookies = (
    event: APIGatewayRequestAuthorizerEvent | APIGatewayProxyEvent
) => {
    if (!event.headers || !event.headers.Cookie) {
        return undefined;
    }

    const cookiesStr = event.headers.Cookie;
    const cookiesArr = cookiesStr.split(";");

    const cookieMap: CookieMap = {};

    for (let cookie of cookiesArr) {
        const cookieSplit = cookie.trim().split("=");
        cookieMap[cookieSplit[0]] = cookieSplit[1];
    }

    return cookieMap;
};

//fn to Validate JWT token issued by a Cognito user pool
export const verifyToken = async (
    token: string,
    userPoolId: string | undefined,
    region: string
): Promise<JwtToken> => {
    try {
        const url = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
        const { data }: { data: Jwk } = await axios.get(url);
        const pem = jwkToPem(data.keys[0]);

        return jwt.verify(token, pem, { algorithms: ["RS256"] });
    } catch (err) {
        console.log(err);
        return null;
    }
};

// fn to dynamically create an IAM policy document that either denies or allows access to the endpoints of our App API
export const createPolicy = (
    event: APIGatewayAuthorizerEvent,
    effect: string
): PolicyDocument => {
    return {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: effect,
                Action: "execute-api:Invoke",
                Resource: [event.methodArn],
            },
        ],
    };
};