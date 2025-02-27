import { createRequire } from 'module'
import { defineConfig, type DefaultTheme } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')
function nav(): DefaultTheme.NavItem[] {
  return [
    {
      text: pkg.version,
      items: [
        {
          text: 'Changelog',
          link: 'https://github.com/ecubus/EcuBus-Pro/blob/master/docs/dev/releases_note.md'
        }
      ]
    },
    {
      text: 'Script API',
      link: 'https://app.whyengineer.com/scriptApi/index.html'
    }
  ]
}
// https://vitepress.dev/reference/site-config

export default withMermaid({
  title: 'EcuBus-Pro',
  ignoreDeadLinks: true,
  description: 'A powerful automotive ECU development tool',
  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        href: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/img/logo256.png'
      }
    ],

    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en' }],
    [
      'meta',
      { property: 'og:title', content: 'EcuBus-Pro | A powerful automotive ECU development tool' }
    ],
    ['meta', { property: 'og:site_name', content: 'EcuBus-Pro' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://ecubus.oss-cn-chengdu.aliyuncs.com/img/logo256.png'
      }
    ],
    ['meta', { property: 'og:url', content: 'https://app.whyengineer.com' }],
    [
      'meta',
      { name: 'google-site-verification', content: '8p_3SCSQGHvWlpmik3zhY902wyQ0QwxQsHaBJocrxfA' }
    ],
    [
      'script',
      {},
      `
      window.__rum = {
    pid: 'fx08lzooek@df6c2cc04f6d757',
    endpoint: 'https://fx08lzooek-default-cn.rum.aliyuncs.com',
    // 设置环境信息，参考值：'prod' | 'gray' | 'pre' | 'daily' | 'local'
    env: 'prod', 
    // 设置路由模式， 参考值：'history' | 'hash'
    spaMode: 'history',
    collectors: {
     
      perf: false,
   
      webVitals: false,
     
      api: false,
   
      staticResource: true,
  
      jsError: false,
      
      consoleError: false,
     
      action: true,
    },
    // 链路追踪配置开关，默认关闭
    tracing: true,
  };
      `
    ],
    ['script', { src: 'https://sdk.rum.aliyuncs.com/v2/browser-sdk.js', crossorigin: 'anonymous' }],
    [
      'script',
      { src: 'https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/viewerjs/1.10.4/viewer.min.js' }
    ],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/viewerjs/1.10.4/viewer.min.css'
      }
    ],
    [
      'script',
      {},
      `
     
      // 初始化图片查看器
      function initImageViewer() {
        
        const container = document.querySelector('.content-container');
        if (!container) return;
       
      
        container.addEventListener('click', function(e) {
          if (e.target.tagName === 'IMG') {
            e.preventDefault();
            
            const images = Array.from(document.querySelectorAll('.content-container img'));
            const currentIndex = images.indexOf(e.target);
            
            const viewerContainer = document.createElement('div');
            viewerContainer.style.display = 'none';
            document.body.appendChild(viewerContainer);
            
            images.forEach(img => viewerContainer.appendChild(img.cloneNode(true)));
            
            const viewer = new Viewer(viewerContainer, {
              zoomRatio: 0.1,
              hidden: function() {
                viewer.destroy();
                document.body.removeChild(viewerContainer);
              }
            });
            
            viewer.show();
            viewer.view(currentIndex);
          }
        });
      }

      // 等待 VitePress 加载完成
      window.addEventListener('load', () => {
        // 初始化
        initImageViewer();

        
      });

      `
    ]
  ],

  lastUpdated: true,

  themeConfig: {
    nav: nav(),
    // https://vitepress.dev/reference/default-theme-config
    outline: {
      level: [2, 4]
    },
    editLink: {
      pattern: 'https://github.com/ecubus/EcuBus-Pro/edit/master/:path',
      text: 'Edit this page on GitHub'
    },
    search: {
      provider: 'algolia',
      options: {
        appId: 'KXFLA7UAD8',
        apiKey: '67edbcb2f3c63548c4bf738d61602a03',
        indexName: 'app-whyengineer'
      }
    },
    sidebar: [
      {
        text: 'About',
        items: [
          { text: 'Introduce', link: '/' },
          { text: 'Visual Tour', link: '/docs/about/screenshots' },
          { text: 'Install', link: '/docs/about/install' },

          { text: 'Sponsor ❤️', link: '/docs/about/sponsor' },
          { text: 'Contact', link: '/docs/about/contact' }
        ]
      },
      {
        text: 'User Manual',
        link: '/docs/um/concept',
        items: [
          { text: 'CAN', link: '/docs/um/can/can.md' },
          { text: 'LIN', link: '/docs/um/lin/lin.md' },
          { text: 'Graph', link: '/docs/um/graph/graph.md' },
          { text: 'CLI', link: '/docs/um/cli.md' },
          {
            text: 'Script',
            link: '/docs/um/script',
            items: [{ text: 'Use External Package', link: '/docs/um/scriptSerialPort' }]
          },
          {
            text: 'Test',
            link: '/docs/um/test/test.md',
            
          },
          {
            text: 'Database',
            link: '/docs/um/database',
            items: [
              { text: 'LIN LDF', link: '/docs/um/ldf' },
              { text: 'CAN DBC', link: '/docs/um/dbc' }
            ]
          }
        ]
      },
      {
        text: 'Example',

        items: [
          {
            text: 'CAN',
            items: [
              { text: 'CAN Basic', link: '/examples/can/readme' },
              { text: 'NXP UDS Bootloader', link: '/examples/nxp_bootloader/readme' }
            ],
            collapsed: true
          },
          {
            text: 'LIN',
            items: [
              { text: 'LIN General', link: '/examples/lin/readme' },
              { text: 'LIN TP', link: '/examples/lin_tp/readme' }
            ],
            collapsed: true
          },
          {
            text: 'DOIP',
            items: [
              { text: 'DoIP Tester', link: '/examples/doip/readme' },
              { text: 'DoIP Simulate Entity', link: '/examples/doip_sim_entity/readme' }
            ],
            collapsed: true
          },
          {
            text: 'UDS',
            items: [
              { text: 'UDS Hex File', link: '/examples/uds_hex_file/readme' },
              { text: 'Secure Access dll', link: '/examples/secure_access_dll/readme' }
            ],
            collapsed: true
          },
          {
            text: 'Test',
            items: [{ text: 'Test Simple', link: '/examples/test_simple/readme' }],
            collapsed: true
          }
        ]
      },
      {
        text: 'Developer Manual',
        collapsed: true,
        items: [
          { text: 'Arch', link: '/docs/dev/arch' },
          {
            text: 'Setup',
            link: '/docs/dev/setup',
            items: [
              {
                text: 'Learning Resources',
                link: '/docs/dev/jslearn'
              }
            ]
          },
          { text: 'Comp Test', link: '/docs/dev/test' },
          { text: 'Addon', link: '/docs/dev/addon' },

          { text: 'Releases Note', link: '/docs/dev/releases_note' }
        ]
      }
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/ecubus/EcuBus-Pro' }]
  },
  rewrites: {
    'README.md': 'index.md',
    'resources/examples/:pkg/:slug*': 'examples/:pkg/:slug*'
  },
  sitemap: {
    hostname: 'https://app.whyengineer.com'
  }
})
