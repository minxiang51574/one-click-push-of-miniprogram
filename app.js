#!/usr/bin/env node
const inquirer = require("inquirer");
const shell = require("shelljs");
const path = require("path");
const fs = require("fs");
const ci = require("miniprogram-ci");
const jsonfile = require("jsonfile");
const { Command } = require('commander');
const program = new Command();

program
  .name('wx-cli')
  .description('uniapp 一键构建发包上传')
  .version('1.0.0');

const pattern = /^(yunfan-mobile)([^\s]*)(-frontend)$/;
let appCount = 0
let appTotal = 0

/**
 *
 * @returns 获取上一层目录
 */
const getUpperStorytDirectory = () => path.resolve(__dirname, "../");

/**
 *
 * @param {path} path 文件路径名
 * @returns 当前工作目录中，小程序的应用
 */
const getDirectory = async path => {
  const dirArr = await fs.promises.readdir(path);
  const result = [];
  for (const dir of dirArr) {
    if (pattern.test(dir)) {
      result.push(dir);
    }
  }
  return result;
};


const pushCodeVersion = (path, fileName = 'src/manifest.json') => {
  return new Promise((resolve, reject) => {
    shell.exec(
      `${path} && git add ${fileName} && git commit ${fileName} -m "版本同步" && git push`,
      {
        silent: true
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          reject(error);
          return;
        }
        const latestTag = stdout.trim();
        resolve(latestTag);
      }
    );
  })

}


const pushCodeInstall = (path) => {
  return new Promise((resolve, reject) => {
    shell.exec(
      `${path} && npm i && git add package.json package-lock && git commit package.json package-lock -m "版本同步" && git push`,
      {
        silent: true
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          reject(error);
          return;
        }
        const latestTag = stdout.trim();
        resolve(latestTag);
      }
    );
  })

}

const getVersion = path => {
  return new Promise((resolve, reject) => {
    shell.exec(
      `${path} && git describe --abbrev=0 --tags`,
      {
        silent: true
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          reject(error);
          return;
        }
        const latestTag = stdout.trim();
        resolve(latestTag);
      }
    );
  });
};

/**
 * 
 * @param {string} appId 小程序Id
 * @param {string} app 小程序名
 * @returns 返回一个ci实例
 */
const getInstance = (appId, app) => {
  return new ci.Project({
    appid: appId, // 小程序appid
    type: "miniProgram", // 类型，小程序或小游戏
    projectPath: path.join(__dirname, `../${app}/dist/build/mp-weixin`), // 项目路径
    privateKeyPath: path.join(__dirname, `/keys/${app}.key`), // 密钥路径
    ignores: ["node_modules/**/*"] // 忽略的文件
  });
}


//上传
const update = (option) => {
  console.log('开始上传')
  const { app, appId, version, remark, robot } = option
  return new Promise(async resovle => {
    const project = getInstance(appId, app)
    ci.upload({
      project,
      version: version,
      desc: remark,
      robot: robot,
      setting: {
        es6: true, // 是否 "es6 转 es5"
        es7: true, // 是否 "es7 转 es5"
        minify: true, // 是否压缩代码,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true,
      },
      onProgressUpdate: res => {
        // process.stdout.write(`进度：${appCount}/${appTotal} ${app}:${res}`)
      }
    })
      .then(async res => {
        process.stdout.write(`${app}上传成功`)
        resovle();
      })
      .catch(error => {
        process.stderr.write(`${app}上传失败:${error}`)
        resovle();
        process.exit(-1);
      });
  });
};

//预览
const preview = (option) => {
  const { app, appId, version, remark, robot, pagePath } = option
  return new Promise(async resovle => {
    const project = getInstance(appId, app)
    ci.preview({
      project,
      version: version,
      desc: remark,
      robot: robot,
      setting: {
        es6: true, // 是否 "es6 转 es5"
        es7: true, // 是否 "es7 转 es5"
        minify: true, // 是否压缩代码,
        autoPrefixWXSS: true,
        minifyWXML: true,
        minifyJS: true,
      },
      qrcodeFormat: 'image',
      qrcodeOutputDest: `./${app}.jpg`,
      pagePath: pagePath,
      onProgressUpdate: res => {
        console.log(`${app}:${res}`);
      }
    })
      .then(async res => {
        console.log(`${app}上传成功`);
        resovle();
      })
      .catch(error => {
        console.log(`${app}上传失败:${error}`);
        resovle();
        process.exit(-1);
      });
  });
};

const gather = dirList => {
  return inquirer.prompt([
    {
      type: "list",
      message: "请选择你要发布的环境",
      name: "env",
      choices: [
        { name: "dev", value: "build:dev:mp-weixin" },
        { name: "test", value: "build:test:mp-weixin" },
        { name: "pre", value: "build:pre:mp-weixin" },
        { name: "pro", value: "build:mp-weixin" }
      ]
    },
    {
      type: "checkbox",
      message: "请选择你要发布的小程序?",
      name: "apps",
      choices: dirList.map(v => ({ name: v, value: v }))
    },
    {
      type: "input",
      name: "remark",
      message: "备注:"
    }
  ]);
};


const gatherApps = dirList => {
  return inquirer.prompt([
    {
      type: "checkbox",
      message: "请选择你要更新的程序?",
      name: "apps",
      choices: dirList.map(v => ({ name: v, value: v }))
    },
  ]);
};


//更新版本
function increaseVersion (version) {
  const verArr = version.split(".");
  let i = verArr.length - 1;
  while (i >= 0) {
    if (verArr[i] < 9) {
      verArr[i]++;
      break;
    } else {
      verArr[i] = 0;
      i--;
    }
  }
  if (i < 0) {
    verArr.unshift("1");
  }
  return verArr.join(".");
}

const getManifest = (dir, env) => {
  return new Promise(resolve => {
    fs.readFile(`../${dir}/src/manifest.json`, "utf8", (err, data) => {
      if (err) throw err;
      // 删除注释
      data = data.replace(/\/\/.*?\n|\/\*(.*?)\*\//g, "");
      // 将JSON字符串转换为JavaScript对象
      const config = JSON.parse(data);
      config.versionName = env === 'build:mp-weixin' ? increaseVersion(config.versionName) : config.versionName
      resolve({
        appId: config["mp-weixin"].appid,
        version: config.versionName
      });
      if (env === 'build:mp-weixin') {
        setTimeout(() => {
          jsonfile.writeFile(`../${dir}/src/manifest.json`, config, { spaces: 2 }, err => {
            if (err) throw err;
            pushCodeVersion(`cd ../${dir}`)
            console.log("文件已保存");
          });
        }, 0)
      }
    });
  });
};


const updatePatch = (version) => {
  const code = version.split('.')
  return '^0.1.192'
}

const updatePackage = (dir) => {
  return new Promise(resolve => {
    fs.readFile(`../${dir}/package.json`, "utf8", (err, data) => {
      if (err) throw err;
      // 删除注释
      data = data.replace(/\/\/.*?\n|\/\*(.*?)\*\//g, "");
      // 将JSON字符串转换为JavaScript对象
      const config = JSON.parse(data);

      config.dependencies[`@yunfan/frame-uniapp`] = updatePatch(config.dependencies[`@yunfan/frame-uniapp`])
      config.dependencies['@km/mdm-ui'] = "^0.0.85"
      // config.dependencies[`@km/mdm-ui`] = "^0.0.28"
      // config.dependencies[`@km/mdm-ui`] = '^0.0.24'


      setTimeout(() => {
        jsonfile.writeFile(`../${dir}/package.json`, config, { spaces: 2 }, err => {
          if (err) throw err;
          resolve()
          console.log("文件已保存");
        });
      }, 0)

    });
  });
};

async function init (action, option) {
  const appList = await getDirectory(getUpperStorytDirectory());
  const answers = await gather(appList);
  const { env, apps, remark } = answers;
  if (apps.length === 0) {
    console.log("请选择应用");
    return;
  }
  appTotal = apps.length
  for (const app of apps) {
    appCount++
    const config = await getManifest(app, env);
    shell.exec(`cd ../ && cd ${app} ${option.install ? '&& npm i' : ''} && npm run ${env}`);
    await action({ app, remark, ...config, ...option });
  }
}

async function autoInit (action, option) {
  const { env, app, remark } = option;
  if (!app) {
    process.stdout.write('请选择应用')
    return;
  }
  appTotal = 1
  appCount++
  const config = await getManifest(app, env);
  shell.exec(`cd ../ && cd ${app} ${option.install ? '&& npm i' : ''}  && npm run "build:${env === 'master' ? '' : `${env}:`}mp-weixin"`);
  await action({ app, remark, ...config, ...option});
}


async function installInit () {
  const appList = await getDirectory(getUpperStorytDirectory());
  const answers = await gatherApps(appList);
  const { apps, } = answers;
  if (apps.length === 0) {
    console.log("请选择应用");
    return;
  }
  appTotal = apps.length
  for (const app of apps) {
    appCount++
    await updatePackage(app)
    console.log("%c Line:279 🥖 apps", "color:#3f7cff", app);
    // const config = await getManifest(app, env);
    // && git checkout master && git pull && git merge feature/v1.6.4 && git push
    shell.exec(`cd ../ && cd ${app} && npm install && git pull && git add package.json package-lock.json && git commit package.json package-lock.json -m "版本同步" && git push`);

  }
}

async function checkoutInstall () {
  const appList = await getDirectory(getUpperStorytDirectory());
  const answers = await gatherApps(appList);
  const { apps, branch} = answers;
  if (apps.length === 0) {
    console.log("请选择应用");
    return;
  }
  appTotal = apps.length
  for (const app of apps) {
    appCount++
    console.log(app + '：切成功')
    shell.exec(`cd ../ && cd ${app} &&  git pull && git checkout ${branch}`);
    // shell.exec(`cd ../ && cd ${app} &&  git pull && npm link @yunfan/frame-uniapp`);
  }
}

program.command('update')
  .description('上传小程序')
  .action(() => {
    const { robot, install } = program.opts()
    init(update, { robot, install })
  });


program.command('preview')
  .description('预览小程序')
  .action(() => {
    const { robot, pagePath } = program.opts()
    init(preview, { robot, pagePath })
  });


program.command('install')
  .description('安装最新的远程服务包')
  .action(() => {
    installInit()
  });

program.command('checkout')
  .description('安装最新的远程服务包')
  .action(() => {
    checkoutInstall()
  });

program.command('push')
  .description('自动化上传小程序')
  .action(() => {
    const res = program.opts()
    // process.stdout.write(`${JSON.stringify(res)}上传成功`)
    autoInit(update, res)
  });

program.option('-a, --app <string>', 'app 名称', '');
program.option('-e, --env <string>', '环境', '');
program.option('-m, --remark <string>', '备注', '');
program.option('-r, --robot <number>', '机器人1-31，默认为1', 1);
program.option('-p, --pagePath <string>', '预览页面路径', 'pages/login/index')
program.option('-i, --install', '依赖下载')
program.parse();



