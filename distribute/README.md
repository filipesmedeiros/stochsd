# Todo list for uploading new version

### Create new StochSD version:

#### Build general versions with gulp

1. Goto: `stochsd/distribute/`

2. Run `npm install`

3. Optional(if you want to bump the version): Update version with `npm run update-version`
   Note: The version number is checked in into git, and does not always need to be bumped

4. Run command: `npm run build`

   ###### This runs `gulp` and creates the folder `stochsd/distribute/output/` containing `app/` (the desktop app source, unbundled) and `web/` (the web version, bundled).

**Note:** If problems arise with gulp, set latest versions of [gulp](https://www.npmjs.com/package/gulp) and [gulp-useref](https://www.npmjs.com/package/gulp-useref) or 
learn more at https://www.udemy.com/starting-with-gulp/learn/v4/content.

#### Make desktop installers (Electron)

The desktop app is a normal Electron app packaged with
[electron-builder](https://www.electron.build/), from `stochsd/distribute/`:

- `npm run dist:mac` — builds `output/dist-electron/*.dmg` and `*.zip`
- `npm run dist:linux` — builds `output/dist-electron/*.AppImage`
- `npm run dist:win` — builds `output/dist-electron/*.exe` (portable)
- `npm run dist` — builds all three

Each of these runs `npm run build` first, so there's no separate download step
— electron-builder fetches the Electron binary for the target platform(s)
itself. Building the Windows target from macOS or Linux works without
installing anything extra since it targets `portable` (no installer); an NSIS
installer would need Wine or an actual Windows machine/CI runner.

Config lives in `distribute/electron-builder.json`. The version comes from
`stochsd/OpenSystemDynamics/src/version.js`, same as before.

For local development without packaging anything, `electron .` from the repo
root runs the app straight from source.



## Uploading StochSD to SourceForge via the website. 

__NOTE__: don't use the SourceForge website for uploading since it is not as reliable.

- To upload StochSD Web with FileZilla

  - Host: [web.sourceforge.net](http://web.sourceforge.net)  
  - Login with credentials 
  - Default folder for desktop-version upload: `/home/pfs/project/stochsd` 
  - Default folder for web-version upload: `/home/project-web/s/st/stochsd/htdocs`

- Upload `build/stochsd-web` and replace folder `/home/project-web/s/st/stochsd/htdocs/software` with same name.

  ##To update website 

- Open repo `website_stochsd` 

- Run `npm run build`. This creates a `./build` folder

- upload `./build` to Filezilla and replace `homepage/`

## Local App data on windows

Settings for applications in folder:

`C:\Users\[username]\AppData\Local`




