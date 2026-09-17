/**
 * LogicFlow 实例类型：用宽松别名，避免 class 声明与运行时实例不兼容。
 */
// LogicFlow 的 .d.ts 把部分内部方法暴露在实例类型上，导致 new 出的对象无法赋给 LogicFlow。
// 编辑器侧统一用 any 承载实例，调用处仍享受成员补全（通过 as）。
export type LfInstance = any
