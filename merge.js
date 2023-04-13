
const inquirer = require("inquirer");
const shell = require("shelljs");
const path = require("path");
const fs = require("fs");

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
        result.push(dir);
    }
    return result;
};

// 询问流畅
const gather = dirList => {
    return inquirer.prompt([
      {
        type: "list",
        message: "请选择你要发布的环境",
        name: "env",
        choices: [
          { name: "dev", value: "dev" },
          { name: "test", value: "test" },
          { name: "pre", value: "master" },
          { name: "pro", value: "master" }
        ]
      },
      {
        type: "checkbox",
        message: "请选择你要合并的项目?",
        name: "apps",
        choices: dirList.map(v => ({ name: v, value: v }))
      },
      {
        type: "input",
        name: "branch",
        message: "被合并分支:"
      }
    ]);
};

// git合并分支
function gitMerge(baleBranche, mergeBranche){
    const a = shell.exec(`git checkout ${baleBranche}`);
    if(a.code !== 0){
        console.log(a)
        return false
    }
    const b = shell.exec(`git pull`);
    if(b.code !== 0){
        console.log(b)
        return false
    }
    const c = shell.exec(`git merge origin/${mergeBranche}`);
    if(c.code !== 0){
        console.log(c)
        return false
    }
    const d = shell.exec(`git push`);
    if(d.code !== 0){
        console.log(d)
        return false
    }
    return true
}

async function init(){
    const appList = await getDirectory(getUpperStorytDirectory())
    const { env, apps, branch } = await gather(appList)
    for (const app of apps) {
        shell.cd(`../${app}`)
        if(!gitMerge(env, branch)){
            shell.echo(`==========>${app}合并失败`);
            shell.exit(1);
        }
    }
}

init()