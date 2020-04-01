const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

const moduleAnalyser = (filename) => {
    //利用node fs模块读取文件内容
    const content = fs.readFileSync(filename, 'utf-8');
    //使用@babel/parser 分析文件内容生成AST
    const ast = parser.parse(content, {
        sourceType: 'module'
    });
    // console.log(ast);
    //使用 @babel/traverse 分析AST
    const dependencies = {};
    traverse(ast, {
        ImportDeclaration({ node }) {
            //利用 node path 拼接出依赖的完整路径
            const dirname = path.dirname(filename)
            const newFile = path.join(dirname, node.source.value)
            dependencies[node.source.value] = newFile
        }
    })

    // console.log(dependencies);
    //利用@babel/core 解析import语句 ，并且 @babel/preset-env把es6语法转为浏览器可执行的es5
    const { code } = babel.transformFromAst(ast, null, {
        presets: ['@babel/preset-env']
    })
    return {
        filename,
        dependencies,
        code
    }

}

//遍历生成依赖图谱
const makeDependenciesGraph = (entry) => {
    const entryModule = moduleAnalyser(entry);
    const graphArray = [entryModule];
    for (let i = 0; i < graphArray.length; i++) {
        const item = graphArray[i];
        const { dependencies } = item;
        if (dependencies) {
            for (let j in dependencies) {
                graphArray.push(moduleAnalyser(dependencies[j]))
            }
        }
    }
   
    const graph = {};
    graphArray.forEach((item) => {
        graph[item.filename] = {
            dependencies: item.dependencies,//{ './word.js': 'src\\word.js' }
            code: item.code
        }
    })
     console.log(graphArray,'graph');
    return graph;
}

const generateCode = (entry) => {
    const graph = JSON.stringify(makeDependenciesGraph(entry));
    //要先把对象转换为字符串，不然在下面的模板字符串中会默认调取对象的toString方法，参数变成[Object object]
    console.log(graph);
    
    //定义require exports 以便浏览器执行
    return `
        (function(graph){
            //第一层的require
            function require(module){
                function localRequire(relativePath){
                    console.log(relativePath,module)
                    //这里执行第一层的require方法
                    return require(graph[module].dependencies[relativePath])
                }
                var exports={};
                (function (require,exports,code) {
                    eval(code);
                    //执行eval(code)时,code里面还有依赖就继续执行require,
                    //不过这个时候需要把相对路径转成绝对路径，就执行作为require参数名传进来的localRequire,完成路径转换后继续执行第一层的require
                })(localRequire,exports,graph[module].code);
                return exports;
            }
            require('${entry}')
        })(${graph});
    `;


}
const code = generateCode('./src/index.js');
// console.log(code);
