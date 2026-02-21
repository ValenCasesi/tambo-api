import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
// Basic Meta Informations about our API
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Tambo API",
            version: "1.0.0",
            description: "API for Tambo Application",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Local development server",
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
// Function to setup our docs
export const swaggerDocs = (app) => {
    // Route-Handler to visit our docs
    app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    // Make our docs in JSON format available
    app.get("/api/docs.json", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
    });
    console.log("Swagger Docs available at http://localhost:3000/api/docs");
};
