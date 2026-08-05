import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// 暂不启用 R2 增量缓存；需要时再加 NEXT_INC_CACHE_R2_BUCKET 绑定
export default defineCloudflareConfig({});
