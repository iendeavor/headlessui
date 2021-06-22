module.exports = {
  mode: 'jit',
  purge: [],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: '#409eff',
        secondary: '#606266',
        hover: '#f5f7fa',
        disabled: '#c0c4cc',
        border: '#e4e7ed',
      },
    },
  },
  variants: {},
  plugins: [require('@tailwindcss/ui')],
}
