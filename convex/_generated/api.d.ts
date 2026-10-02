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
import type * as customFields from "../customFields.js";
import type * as employees from "../employees.js";
import type * as lib_tenancy from "../lib/tenancy.js";
import type * as lib_validation from "../lib/validation.js";
import type * as members from "../members.js";
import type * as notifications from "../notifications.js";
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
"customFields": typeof customFields,
"employees": typeof employees,
"lib/tenancy": typeof lib_tenancy,
"lib/validation": typeof lib_validation,
"members": typeof members,
"notifications": typeof notifications,
"visitors": typeof visitors,
  }>;
  export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
  export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
  