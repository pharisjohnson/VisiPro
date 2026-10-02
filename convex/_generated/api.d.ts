/* eslint-disable */
  /**
   * Generated `api` utility.
   *
   * THIS CODE IS AUTOMATICALLY GENERATED.
   *
   * To regenerate, run `npx convex dev`.
   * @module
   */
  
  import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
  import type * as ai from "../ai.js";
import type * as aiContext from "../aiContext.js";
import type * as announcements from "../announcements.js";
import type * as appointments from "../appointments.js";
import type * as autoCheckout from "../autoCheckout.js";
import type * as crons from "../crons.js";
import type * as customFields from "../customFields.js";
import type * as employees from "../employees.js";
import type * as http from "../http.js";
import type * as kiosk from "../kiosk.js";
import type * as kioskAdmin from "../kioskAdmin.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_sms from "../lib/sms.js";
import type * as lib_svix from "../lib/svix.js";
import type * as lib_tenancy from "../lib/tenancy.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_visits from "../lib/visits.js";
import type * as members from "../members.js";
import type * as notifications from "../notifications.js";
import type * as settings from "../settings.js";
import type * as sms from "../sms.js";
import type * as visitors from "../visitors.js";

  /**
   * A utility for referencing Convex functions in your app's API.
   *
   * Usage:
   * ```js
   * const myFunctionReference = api.myModule.myFunction;
   * ```
   */
  declare const fullApi: ApiFromModules<{
    "ai": typeof ai,
"aiContext": typeof aiContext,
"announcements": typeof announcements,
"appointments": typeof appointments,
"autoCheckout": typeof autoCheckout,
"crons": typeof crons,
"customFields": typeof customFields,
"employees": typeof employees,
"http": typeof http,
"kiosk": typeof kiosk,
"kioskAdmin": typeof kioskAdmin,
"lib/rateLimit": typeof lib_rateLimit,
"lib/settings": typeof lib_settings,
"lib/sms": typeof lib_sms,
"lib/svix": typeof lib_svix,
"lib/tenancy": typeof lib_tenancy,
"lib/validation": typeof lib_validation,
"lib/visits": typeof lib_visits,
"members": typeof members,
"notifications": typeof notifications,
"settings": typeof settings,
"sms": typeof sms,
"visitors": typeof visitors,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  