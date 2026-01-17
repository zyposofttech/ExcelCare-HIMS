/**
 * Infrastructure DTOs
 *
 * Note: Prefer importing DTOs from their sub-module folders (e.g., `./location/dto`).
 * This file is kept as a thin barrel export for backward compatibility while
 * the monolithic controller/service are phased out.
 */

export * from "./location/dto";
export * from "./unit-types/dto";
export * from "./units/dto";
export * from "./rooms/dto";
export * from "./resources/dto";
export * from "./branch-config/dto";
export * from "./equipment/dto";
export * from "./charge-master/dto";
export * from "./service-items/dto";
export * from "./fixit/dto";
export * from "./scheduling/dto";
export * from "./import/dto";
export * from "./golive/dto";
