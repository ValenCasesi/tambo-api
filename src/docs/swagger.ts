import swaggerJSDoc, { OAS3Options } from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Application, Request, Response } from "express";

// Basic Meta Informations about our API
const options: OAS3Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Tambo API",
            version: "1.0.0",
            description: "API for Tambo Application",
        },
        servers: [
            {
                url: "/",
                description: "Relative to current server (Vercel Prod / Local)",
            },
            {
                url: "http://localhost:3000",
                description: "Local development server (Fallback)",
            }
        ],
    },
    // Allows us to add swagger annotations inside our controllers/routes
    // Vercel compiles and reads from /dist
    apis: [
        "./src/routes/*.ts",
        "./src/controller/*.ts",
        "./dist/routes/*.js",
        "./dist/controller/*.js",
    ],
};

// Docs in JSON format
const swaggerSpec = swaggerJSDoc(options);

const CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui.min.css";

// Function to setup our docs
export const swaggerDocs = (app: Application) => {
    // Route-Handler to visit our docs
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss:
            '.swagger-ui .opblock .opblock-summary-path-description-wrapper { align-items: center; display: flex; flex-wrap: wrap; gap: 0 10px; padding: 0 10px; width: 100%; }',
        customCssUrl: CSS_URL,
        customJs: [
            "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-bundle.js",
            "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.18.3/swagger-ui-standalone-preset.js",
        ],
    }));
    // Make our docs in JSON format available
    app.get("/api/docs.json", (req: Request, res: Response) => {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
    });

    console.log("Swagger Docs available at http://localhost:3000/api/docs");
};
