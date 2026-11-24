export const laravelModeEnabled =
  import.meta.env?.MODE !== 'test' &&
  (import.meta.env?.MODE === 'laravel' ||
    import.meta.env?.VITE_ENABLE_LARAVEL_ACCOUNT_DIALOG === 'true');
