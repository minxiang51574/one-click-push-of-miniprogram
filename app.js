const inquirer = require("inquirer");
const shell = require("shelljs");
const path = require('path')
const fs = require('fs');
const ci = require('miniprogram-ci');
const _config = require('./config.json')


const appDir = path.resolve(__dirname, '../')

const getDir = async (filename) => {
  let dirArr = await fs.promises.readdir(filename);
  dirArr = dirArr.filter(v => /^(yunfan-mobile)([^\s]*)(-frontend)$/.test(v))
  return Promise.all(dirArr)
}

const update = (app,remark)=>{
  return new Promise(async (resovle)=>{
    const version =  _config[app].version
    const appid = _config[app].appid
    const project = new ci.Project({
      appid: appid, // 小程序appid
      type: "miniProgram", // 类型，小程序或小游戏
      projectPath: path.join(__dirname, `../${app}/dist/build/mp-weixin`), // 项目路径
      privateKeyPath: process.cwd() + `/keys/${app}.key`, // 密钥路径
      ignores: ["node_modules/**/*"], // 忽略的文件
    });
    ci.upload({
      project,
      version: version,
      desc: remark, 
      setting: {
        es6: false,// 是否 "es6 转 es5"
        es7: false,// 是否 "es7 转 es5"
        autoPrefixWXSS: true,
        minify: true,// 是否压缩代码
      },
      onProgressUpdate:(res)=>{
        console.log(`${app}:${res}`)
      }
    })
      .then(async (res) => {
        console.log(`${app}上传成功`)
        resovle();
      })
      .catch((error) => {
        console.log(`${app}上传失败:${error}`)
        resovle();
        process.exit(-1);
      });
  })
}

const runInquirer = (dirName) => {
  inquirer
    .prompt([
      {
        type: "list",
        message: "请选择你要发布的环境",
        name: "env",
        choices: [
          { name: 'dev', value: "build:dev:mp-weixin" },
          { name: 'test', value: "build:test:mp-weixin" },
          { name: 'pre', value: "build:pre:mp-weixin" },
          { name: 'pro', value: "build:mp-weixin" },
        ]
      },
      {
        type: "checkbox",
        message: "请选择你要发布的小程序?",
        name: "apps",
        choices: dirName.map(v => ({ name: v, value: v }))
      },
      {
        type: "input", // 类型
        name: "remark", // 字段名称，在then里可以打印出来
        message: "备注:", // 提示信息
      },
    ])
    .then(async answers => {
      const { env, apps, remark } = answers
      if (apps.length === 0) {
        return
      }
      for (const app of apps) {
        shell.exec(`cd ../ && cd ${app} && npm run ${env}`)
        await update(app,remark)
      }
    })
}

getDir(appDir).then(res => {
  runInquirer(res)
})










