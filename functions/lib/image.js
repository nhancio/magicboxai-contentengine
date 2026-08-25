"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderImageBuffer = renderImageBuffer;
const models_1 = require("./models");
async function renderImageBuffer(args) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const response = await args.ai.models.generateContent({
        model: models_1.MODELS.image,
        contents: args.prompt.slice(0, 8000),
        // Nano Banana returns text alongside the image; both modalities are
        // requested and the text part is ignored below.
        config: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
                aspectRatio: (_a = args.aspectRatio) !== null && _a !== void 0 ? _a : "1:1",
                imageSize: (_b = args.imageSize) !== null && _b !== void 0 ? _b : "1K",
            },
        },
    });
    const parts = (_f = (_e = (_d = (_c = response.candidates) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.parts) !== null && _f !== void 0 ? _f : [];
    const data = (_h = (_g = parts.find((part) => { var _a; return (_a = part.inlineData) === null || _a === void 0 ? void 0 : _a.data; })) === null || _g === void 0 ? void 0 : _g.inlineData) === null || _h === void 0 ? void 0 : _h.data;
    if (!data) {
        throw new Error(`No image returned from ${models_1.MODELS.image}`);
    }
    return Buffer.from(data, "base64");
}
//# sourceMappingURL=image.js.map