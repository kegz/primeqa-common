import { Request, Response, NextFunction } from "express";

import { httpClient, createHttpClient } from "./client";
export const example1_simpleGet = async () => {
  try {
    const response = await httpClient.get<{ id: string; name: string }>(
      "https://api.example.com/users/123",
    );
    console.log("User:", response.data);
    console.log("Status:", response.status);
  } catch (error) {
    console.error("Failed to fetch user:", error);
  }
};
export const example2_post = async () => {
  try {
    const newUser = { name: "John Doe", email: "john@example.com" };
    const response = await httpClient.post(
      "https://api.example.com/users",
      newUser,
    );
    console.log("Created user:", response.data);
  } catch (error) {
    console.error("Failed to create user:", error);
  }
};
export const example3_propagateHeaders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const response = await httpClient.get("https://api.example.com/projects", {
      req,
    });

    return res.json(response.data);
  } catch (error) {
    next(error);
  }
};
export const example4_customOptions = async () => {
  try {
    const response = await httpClient.get("https://slow-api.example.com/data", {
      timeout: 30000,
      retries: 3,
      retryDelay: 2000,
    });
    console.log("Data:", response.data);
  } catch (error) {
    console.error("Request failed after retries:", error);
  }
};
const userServiceClient = createHttpClient({
  baseUrl: "https://user-service.internal.com",
  timeout: 10000,
  retries: 2,
  headers: {
    "X-Service-Name": "project-service",
  },
});

export const example5_serviceClient = async (req: Request) => {
  const user = await userServiceClient.get<{ id: string; name: string }>(
    "/api/users/123",
    { req },
  );
  const newUser = await userServiceClient.post(
    "/api/users",
    { name: "Jane Doe", email: "jane@example.com" },
    { req },
  );

  return { user: user.data, newUser: newUser.data };
};

interface Project {
  id: string;
  name: string;
  userId: string;
  tenantId: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const projectServiceClient = createHttpClient({
  baseUrl: process.env.PROJECT_SERVICE_URL || "http://localhost:3001",
  timeout: 5000,
  retries: 2,
});

const userServiceClient2 = createHttpClient({
  baseUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
  timeout: 5000,
  retries: 2,
});

export const getProjectWithUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const projectId = req.params.id;
    const projectResponse = await projectServiceClient.get<Project>(
      `/api/projects/${projectId}`,
      { req },
    );

    const project = projectResponse.data;
    const userResponse = await userServiceClient2.get<User>(
      `/api/users/${project.userId}`,
      { req },
    );

    const user = userResponse.data;
    return res.json({
      success: true,
      data: {
        ...project,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};
export const example7_noHeaderPropagation = async (req: Request) => {
  try {
    const response = await httpClient.get(
      "https://public-api.example.com/data",
      {
        req,
        propagateAuth: false,
        propagateCorrelationId: false,
      },
    );
    console.log("Public API response:", response.data);
    return response.data;
  } catch {
    throw new Error("Failed to fetch public API");
  }
};
export const example8_customHeaders = async () => {
  try {
    const response = await httpClient.get("https://api.example.com/data", {
      headers: {
        "X-API-Key": process.env.EXTERNAL_API_KEY || "",
        "X-Custom-Header": "custom-value",
      },
    });
    console.log("Custom header response:", response.data);
    return response.data;
  } catch {
    throw new Error("Failed to fetch with custom headers");
  }
};
export const example9_errorHandling = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const response = await userServiceClient2.get<User>(`/api/users/123`, {
      req,
    });

    return res.json({ success: true, data: response.data });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    if (err.status === 503) {
      const message =
        typeof err.message === "string" ? err.message : "Unknown error";
      console.error("Dependency service unavailable:", message);
    }
    next(error);
  }
};
