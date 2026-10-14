const { app, BrowserWindow, protocol, net, shell, session, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const name = 'Prisma Arquitectura', smoke = process.argv.includes('--smoke-test');
app.setName(name); app.setPath('userData', path.join(app.getPath('appData'), 'PrismaArquitectura'));
protocol.registerSchemesAsPrivileged([{ scheme: 'prisma-architecture', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let win, pendingProject = null;
function projectArgument(args) { return args.find(a => !a.startsWith('--') && a.toLowerCase().endsWith('.prisma-arquitectura')); }
function readProject(filename) { const target = path.resolve(filename); if (!fs.statSync(target).isFile() || fs.statSync(target).size > 10 * 1024 * 1024) throw Error('El proyecto debe ser un archivo de hasta 10 MB.'); return fs.readFileSync(target, 'utf8'); }
function openProject(args) { const filename = projectArgument(args); if (!filename) return; try { const text = readProject(filename); if (win?.webContents && !win.webContents.isLoading()) win.webContents.send('architecture-open-file', text); else pendingProject = text; } catch (e) { console.error(e.message); } }
if (!app.requestSingleInstanceLock()) app.quit();
else {
  openProject(process.argv);
  app.on('second-instance', (_event, args) => { openProject(args); if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    const root = path.resolve(__dirname, '../dist-arquitectura');
    protocol.handle('prisma-architecture', async request => {
      try { const url = new URL(request.url); if (url.host !== 'app') return new Response('Not found', { status: 404 }); const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html', target = path.resolve(root, relative); if (target !== root && !target.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 }); const response = await net.fetch(pathToFileURL(target).href); const headers = new Headers(response.headers); headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'"); return new Response(response.body, { status: response.status, headers }); } catch { return new Response('Not found', { status: 404 }); }
    });
    win = new BrowserWindow({ show: !smoke, width: 1500, height: 980, minWidth: 900, minHeight: 650, backgroundColor: '#f7f8fc', title: name, icon: path.join(root, 'icons/prisma-512.png'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'architecture-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
    ipcMain.handle('architecture-take-project', event => { if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !event.sender.getURL().startsWith('prisma-architecture://app/')) throw Error('Origen de proyecto inválido.'); const text = pendingProject; pendingProject = null; return text; });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: 'Guardar archivo de Prisma Arquitectura', defaultPath: path.join(app.getPath('documents'), item.getFilename()) }));
    const external = url => { try { const u = new URL(url); if (u.protocol === 'https:' && ['github.com', 'oscard0823.github.io'].includes(u.host)) void shell.openExternal(u.href); } catch {} };
    win.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
    win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('prisma-architecture://app/')) { event.preventDefault(); external(url); } });
    if (smoke) {
      const errors = []; win.webContents.on('console-message', details => { if (details.level === 'error') errors.push(details.message); }); win.webContents.on('did-fail-load', (_e, code, message) => { console.error(code, message); app.exit(1); });
      win.webContents.on('did-finish-load', async () => {
        const deadline = Date.now() + 30000; let result;
        while (Date.now() < deadline) { result = await win.webContents.executeJavaScript("({title:document.title,ready:document.documentElement.dataset.architectureReady,canvas:!!document.querySelector('.pa-scene canvas'),alert:document.querySelector('[role=alert]')?.textContent||''})"); if (result.ready && result.canvas) break; await new Promise(resolve => setTimeout(resolve, 250)); }
        console.log(JSON.stringify({ ...result, errors, bundled: true })); app.exit(result?.ready && result?.canvas && !errors.length && !result.alert ? 0 : 1);
      });
    }
    await win.loadURL(`prisma-architecture://app/index.html${smoke ? '?smoke=1' : ''}`);
  }).catch(error => { console.error(error); app.exit(1); });
}
app.on('window-all-closed', () => app.quit());
