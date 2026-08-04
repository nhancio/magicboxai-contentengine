/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as brands from "../brands.js";
import type * as carousel from "../carousel.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bestTime from "../lib/bestTime.js";
import type * as lib_contentEngine from "../lib/contentEngine.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_models from "../lib/models.js";
import type * as lib_presets from "../lib/presets.js";
import type * as lib_providers_base from "../lib/providers/base.js";
import type * as lib_providers_facebook from "../lib/providers/facebook.js";
import type * as lib_providers_instagram from "../lib/providers/instagram.js";
import type * as lib_providers_linkedin from "../lib/providers/linkedin.js";
import type * as lib_providers_reddit from "../lib/providers/reddit.js";
import type * as lib_providers_registry from "../lib/providers/registry.js";
import type * as lib_providers_twitter from "../lib/providers/twitter.js";
import type * as lib_providers_types from "../lib/providers/types.js";
import type * as lib_providers_whatsapp from "../lib/providers/whatsapp.js";
import type * as lib_providers_youtube from "../lib/providers/youtube.js";
import type * as maya from "../maya.js";
import type * as media from "../media.js";
import type * as myVideo from "../myVideo.js";
import type * as posts from "../posts.js";
import type * as publish from "../publish.js";
import type * as scheduler from "../scheduler.js";
import type * as social from "../social.js";
import type * as studio from "../studio.js";
import type * as trends from "../trends.js";
import type * as users from "../users.js";
import type * as video from "../video.js";
import type * as warmedAccountListings from "../warmedAccountListings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  brands: typeof brands;
  carousel: typeof carousel;
  credits: typeof credits;
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/bestTime": typeof lib_bestTime;
  "lib/contentEngine": typeof lib_contentEngine;
  "lib/gemini": typeof lib_gemini;
  "lib/models": typeof lib_models;
  "lib/presets": typeof lib_presets;
  "lib/providers/base": typeof lib_providers_base;
  "lib/providers/facebook": typeof lib_providers_facebook;
  "lib/providers/instagram": typeof lib_providers_instagram;
  "lib/providers/linkedin": typeof lib_providers_linkedin;
  "lib/providers/reddit": typeof lib_providers_reddit;
  "lib/providers/registry": typeof lib_providers_registry;
  "lib/providers/twitter": typeof lib_providers_twitter;
  "lib/providers/types": typeof lib_providers_types;
  "lib/providers/whatsapp": typeof lib_providers_whatsapp;
  "lib/providers/youtube": typeof lib_providers_youtube;
  maya: typeof maya;
  media: typeof media;
  myVideo: typeof myVideo;
  posts: typeof posts;
  publish: typeof publish;
  scheduler: typeof scheduler;
  social: typeof social;
  studio: typeof studio;
  trends: typeof trends;
  users: typeof users;
  video: typeof video;
  warmedAccountListings: typeof warmedAccountListings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
