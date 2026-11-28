module.exports = function (api) {
  api.cache(true);
  // zustand (middleware/persist) يستخدم import.meta؛ هذا الخيار يحوّله ليشتغل على الويب وأندرويد
  return { presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]] };
};
