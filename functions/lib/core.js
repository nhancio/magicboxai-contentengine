"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringifyError = exports.getPublicUrl = exports.getBucket = exports.requireAuth = exports.getAI = exports.db = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = admin.firestore();
const getAI = () => {
    const projectId = process.env.GCLOUD_PROJECT || admin.app().options.projectId;
    return new genai_1.GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: "us-central1",
    });
};
exports.getAI = getAI;
const requireAuth = (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    return request.auth.uid;
};
exports.requireAuth = requireAuth;
const getBucket = () => admin.storage().bucket();
exports.getBucket = getBucket;
const getPublicUrl = (filePath) => `https://storage.googleapis.com/${(0, exports.getBucket)().name}/${filePath}`;
exports.getPublicUrl = getPublicUrl;
const stringifyError = (error) => {
    if (error instanceof Error)
        return error.message;
    if (typeof error === "string")
        return error;
    try {
        return JSON.stringify(error);
    }
    catch (_a) {
        return "Unexpected error";
    }
};
exports.stringifyError = stringifyError;
//# sourceMappingURL=core.js.map