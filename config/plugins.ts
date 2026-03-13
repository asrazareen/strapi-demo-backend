import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'csv-export': {
    enabled: true,
    config: {
      maxExportCount: 1000,
      defaultFields: ['id', 'createdAt', 'updatedAt'],
      delimiter: ',',
      encoding: 'utf8',
      exportPath: './exports',
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      debug: env.bool('CSV_EXPORT_DEBUG', false),
    },
  },
});

export default config;
