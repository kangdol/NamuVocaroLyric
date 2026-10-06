(function(global) {
    if (typeof global.setImmediate !== 'function') {
        global.setImmediate = function(fn, ...args) {
            return setTimeout(() => fn(...args), 0);
        };
    }
    const modules = {};
    const cache = {};

    function define(name, factory) {
        modules[name] = factory;
    }

    function resolvePath(currentDir, relativePath) {
        let path = relativePath;
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        if (!path.startsWith('.')) {
            if (path.endsWith('.js')) {
                path = path.substring(0, path.length - 3);
            }
            return path;
        }
        
        const currentParts = currentDir.split('/').filter(Boolean);
        const relParts = path.split('/');
        
        for (const part of relParts) {
            if (part === '.') {
                continue;
            } else if (part === '..') {
                currentParts.pop();
            } else {
                currentParts.push(part);
            }
        }
        
        let resolved = currentParts.join('/');
        if (resolved.endsWith('.js')) {
            resolved = resolved.substring(0, resolved.length - 3);
        }
        if (resolved.startsWith('/')) {
            resolved = resolved.substring(1);
        }
        return resolved;
    }

    function makeRequire(currentFile) {
        const lastSlash = currentFile.lastIndexOf('/');
        const currentDir = lastSlash !== -1 ? currentFile.substring(0, lastSlash) : '';
        return function require(name) {
            if (name === 'extend') return global.NamumarkDependencies.extend;
            if (name === 'async') return global.NamumarkDependencies.async;
            if (name === 'moment') return global.NamumarkDependencies.moment;
            if (name === 'htmlspecialchars') return global.NamumarkDependencies.htmlspecialchars;
            
            // Handles dynamically constructed paths like __dirname + '/index'
            if (name.includes('__dirname') && name.includes('/index')) {
                return loadModule('index');
            }
            
            const resolved = resolvePath(currentDir, name);
            if (cache[resolved]) {
                return cache[resolved].exports;
            }
            return loadModule(resolved);
        };
    }

    function loadModule(name) {
        if (cache[name]) return cache[name].exports;
        
        let factory = modules[name];
        let actualName = name;
        
        if (!factory) {
            const indexName = name + '/index';
            if (modules[indexName]) {
                factory = modules[indexName];
                actualName = indexName;
            }
        }
        
        if (!factory) {
            throw new Error('Module not found: ' + name);
        }
        
        const module = { exports: {} };
        cache[actualName] = module;
        
        const requireFn = makeRequire(actualName);
        const lastSlash = actualName.lastIndexOf('/');
        const dirName = lastSlash !== -1 ? actualName.substring(0, lastSlash) : '';
        
        factory(requireFn, module, module.exports, dirName, actualName);
        return module.exports;
    }

    // Pure Browser Mock Dependencies
    global.NamumarkDependencies = {
        extend: function extend(deep, target, ...sources) {
            if (typeof deep !== 'boolean') {
                sources.unshift(target);
                target = deep || {};
                deep = false;
            }
            if (typeof target !== 'object' && typeof target !== 'function') {
                target = {};
            }
            for (let source of sources) {
                if (!source) continue;
                for (let key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        let val = source[key];
                        if (deep && val && (typeof val === 'object' || Array.isArray(val))) {
                            let isArr = Array.isArray(val);
                            let clone = target[key] ? (isArr ? (Array.isArray(target[key]) ? target[key] : []) : (typeof target[key] === 'object' ? target[key] : {})) : (isArr ? [] : {});
                            target[key] = extend(true, clone, val);
                        } else {
                            target[key] = val;
                        }
                    }
                }
            }
            return target;
        },
        async: {
            map: function(arr, iterator, callback) {
                let results = [];
                let completed = 0;
                let hasErrored = false;
                if (arr.length === 0) {
                    return callback(null, results);
                }
                arr.forEach((item, index) => {
                    iterator(item, (err, res) => {
                        if (hasErrored) return;
                        if (err) {
                            hasErrored = true;
                            return callback(err);
                        }
                        results[index] = res;
                        completed++;
                        if (completed === arr.length) {
                            callback(null, results);
                        }
                    });
                });
            }
        },
        moment: function moment(val) {
            let d;
            if (!val) {
                d = new Date();
            } else {
                d = new Date(val);
            }
            const api = {
                isValid: () => !isNaN(d.getTime()),
                diff: (otherMoment, unit) => {
                    const otherDate = otherMoment._date || new Date(otherMoment);
                    const diffMs = d.getTime() - otherDate.getTime();
                    if (unit === 'days') {
                        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    } else if (unit === 'years') {
                        let age = d.getFullYear() - otherDate.getFullYear();
                        const m = d.getMonth() - otherDate.getMonth();
                        if (m < 0 || (m === 0 && d.getDate() < otherDate.getDate())) {
                            age--;
                        }
                        return age;
                    }
                    return diffMs;
                },
                year: () => d.getFullYear(),
                _date: d
            };
            return api;
        },
        htmlspecialchars: function(str) {
            if (typeof str !== 'string') return str;
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
    };

    global.define = define;
    global.Namumark = function(articleName, options) {
        const NamumarkClass = loadModule('index');
        return new NamumarkClass(articleName, options);
    };
define("basicHTMLRenderer", function(require, module, exports, __dirname, __filename) {
const encodeHTMLComponent = require('htmlspecialchars'),
      moment = require('moment'),
      extend = require('extend'),
      async = require('async'),
      Namumark = require(__dirname + '/index');
let defaultOptions = {
    wiki: {
        exists: (title, isImage) => {return true;},
        includeParserOptions: {},
        resolveUrl: (target, type) => {
            switch(type) {
                case 'wiki':
                    return `/wiki/${target}`
                    break;
                case 'internal-image':
                    return `/file/${target}`
                    break;
            }
        }
    }
};

function HTMLRenderer(_options) {
    let resultTemp = [],
        options = extend(true, defaultOptions, _options),
        headings = [],
        footnotes = [],
        categories = [],
        links = [],
        isHeadingNow = false,
        isFootnoteNow = false,
        lastHeadingLevel = 0,
        hLevels = {1:0,2:0,3:0,4:0,5:0,6:0},
        footnoteCount = 0,
        headingCount = 0,
        lastListOrdered = [],
        wasPreMono = false;
    function appendResult(value) {
        if(isFootnoteNow) {
            footnotes[footnotes.length - 1].value += typeof value === "string" ? value : value.toString();
            return;
        } else if(isHeadingNow) {
            headings[headings.length - 1].value += typeof value === "string" ? value : value.toString();
        }
        if(resultTemp.length === 0)
            resultTemp.push(value);
        else {
            let isArgumentString = typeof value === "string";
            let isLastItemString = typeof resultTemp[resultTemp.length - 1] === "string";
            if(isArgumentString && isLastItemString) {
                resultTemp[resultTemp.length - 1] += value;
            } else {
                resultTemp.push(value);
            }
        }
    }
        function ObjToCssString(obj) {
        let styleString = "";
        const isDark = !document.body.classList.contains('light-mode');
        for(let name in obj) {
            let val = obj[name];
            if (typeof val === 'string' && val.includes(',')) {
                const colors = val.split(',');
                val = isDark ? (colors[1] || colors[0]) : colors[0];
            }
            styleString += `${name}:${val}; `;
        }
        return styleString.substring(0, styleString.length - 1);
    }
    let _ht = this;
    this.processToken = (i) => {
        //console.log(i);
        switch (i.name) {
            case 'blockquote-start':
                appendResult('<blockquote>');
                break;
            case 'blockquote-end':
                appendResult('</blockquote>');
                break;
            case 'list-start':
                lastListOrdered.push(i.listType.ordered);
                appendResult(`<${i.listType.ordered ? 'ol' : 'ul'}${i.listType.type ? ` class="${i.listType.type}"` : ''}>`);
                break;
            case 'list-end':
                appendResult(`</${lastListOrdered.pop() ? 'ol' : 'ul'}>`);
                break;
            case 'indent-start':
                appendResult('<div class="wiki-indent">');
                break;
            case 'indent-end':
                appendResult('</div>');
                break;
            case 'list-item-start':
                appendResult(i.startNo ? `<li value=${encodeHTMLComponent(i.startNo)}>` : '<li>');
                break;
            case 'list-item-end':
                appendResult('</li>');
                break;
            case 'table-start':
                appendResult(`<table${i.options ? " style=\"" + ObjToCssString(i.options) +'"' : ''}>`);
                break;
            case 'table-col-start':
                appendResult(`<td${i.options ? " style=\"" + ObjToCssString(i.options) +'"' : ''}${i.colspan > 0 ? ` colspan=${i.colspan}` : ''}${i.rowspan ? ` rowspan=${i.rowspan}` : ''}>`);
                break;
            case 'table-col-end':
                appendResult('</td>');
                break;
            case 'table-row-end':
                appendResult('</tr>');
                break;
            case 'table-row-start':
                appendResult(`<tr${i.options ? " style=\"" + ObjToCssString(i.options) +'"' : ''}>`);
                break;
            case 'table-end':
                appendResult('</table>');
                break;
            case 'closure-start':
                appendResult('<div class="wiki-closure">');
                break;
            case 'closure-end':
                appendResult('</div>');
                break;
            case 'link-start':
                appendResult(`<a href="${i.internal ? options.wiki.resolveUrl(i.target, 'wiki') : i.target}" class="${i.internal ? 'wiki-internal-link' : ''}${i.external ? 'wiki-external-link' : ''}">`);
                break;
            case 'link-end':
                appendResult('</a>');
                break;
            case 'plain':
                appendResult(encodeHTMLComponent(i.text));
                break;
            case 'new-line':
                appendResult('<br>');
                break;
            case 'add-category':
                categories.push(i.categoryName);
                break;
            case 'image':
                appendResult(`<img src="${options.wiki.resolveUrl(i.target, 'internal-image')}"${i.fileOpts ? ` style=${ObjToCssString(i.fileOpts)}` : ''}></img>`)
                break;
            case 'footnote-start':
                let fnNo = ++footnoteCount;
                appendResult(`<a href="#fn-${fnNo}" id="afn-${fnNo}" class="footnote"><sup class="footnote-sup">[${i.supText ? i.supText : fnNo}] `)
                footnotes.push({sup: i.supText, value: ''});
                isFootnoteNow = true;
                break;
            case 'footnote-end':
                isFootnoteNow = false;
                appendResult('</sup></a>');
                break;
            case 'macro':
                switch (i.macroName) {
                    case 'br':
                        appendResult('<br>');
                        break;
                    case 'dday':
                        if (i.options.length === 0 || typeof i.options[0] !== "string")
                            appendResult('<span class="wikitext-syntax-error">dday 매크로 : 매개변수가 없거나 익명 매개변수가 아닙니다.</span>');
                        else {
                            let mo = moment(i.options[0], 'YYYY-MM-DD')
                            if(!mo.isValid())
                                appendResult('<span class="wikitext-syntax-error">dday 매크로 : 날짜 형식이 잘못됐습니다.</span>')
                            else {
                                let days = -moment().diff(mo, 'days');
                                appendResult(days.toString())
                            }
                        }
                        break;
                    case 'age':
                        if (i.options.length === 0 || typeof i.options[0] !== "string")
                            appendResult('<span class="wikitext-syntax-error">age 매크로 : 매개변수가 없거나 익명 매개변수가 아닙니다.</span>');
                        else {
                            let mo = moment(i.options[0], 'YYYY-MM-DD')
                            let koreanWay = i.options.length > 1 && i.options.slice(1).indexOf('korean') !== -1;
                            if(!mo.isValid())
                                appendResult('<span class="wikitext-syntax-error">age 매크로 : 날짜 형식이 잘못됐습니다.</span>')
                            else {
                                let years = koreanWay ? moment().year() - mo.year() + 1 : moment().diff(mo, 'years');
                                appendResult(years.toString())
                            }
                        }
                        break;
                    case 'date':
                        appendResult(Date.toString());
                        break;
                    case 'youtube':
                        if (i.options.length == 0) {
                            appendResult('<span class="wikitext-syntax-error">오류 : youtube 동영상 ID가 제공되지 않았습니다!</span>')
                        } else if (i.options.length >= 1) {
                            if (typeof i.options[0] === 'string')
                                if (i.options.length == 1)
                                    appendResult(`<iframe src="//www.youtube.com/embed/${i.options[0]}"></iframe>`)
                            else
                                appendResult(`<iframe src="//www.youtube.com/embed/${i.options[0]}" style="${ObjToCssString(i.options.slice(1))}"></iframe>`)
                            else
                                appendResult('<span class="wikitext-syntax-error">오류 : youtube 동영상 ID는 첫번째 인자로 제공되어야 합니다!</span>')
                        }
                        break;
                    case '각주':
                    case 'footnote':
                    case 'footnotes':
                        let footnoteContent = '';
                        for(let j = 0; j < footnotes.length; j++) {
                            let footnote = footnotes[j];
                            footnoteContent += `<a href="#afn-${j+1}" id="fn-${j+1}" class="footnote"><sup class="footnote-sup">[${footnote.sup ? footnote.sup : j+1}]</sup></a> ${footnote.value}<br>`
                        }
                        footnotes = [];
                        appendResult(footnoteContent);
                        break;
                    case '목차':
                    case 'tableofcontents':
                    case 'toc':
                    case 'include':
                        appendResult(i.options ? {name: 'macro', macroName: i.macroName, options: i.options} : {name: 'macro', macroName: i.macroName});
                        break;
                    default:
                        appendResult('[Unsupported Macro]');
                        break;
                }
                break;
            case 'monoscape-font-start':
                wasPreMono = i.pre;
                appendResult((wasPreMono ? '<pre>' : '') + '<code>');
                break;
            case 'monoscape-font-end':
                appendResult('</code>' + (wasPreMono ? '</pre>' : ''));
                break;
            case 'strong-start':
                appendResult('<strong>');
                break;
            case 'italic-start':
                appendResult('<em>');
                break;
            case 'strike-start':
                appendResult('<del>');
                break;
            case 'underline-start':
                appendResult('<u>');
                break;
            case 'superscript-start':
                appendResult('<sup>');
                break;
            case 'subscript-start':
                appendResult('<sub>');
                break;
            case 'strong-end':
                appendResult('</strong>');
                break;
            case 'italic-end':
                appendResult('</em>');
                break;
            case 'strike-end':
                appendResult('</del>');
                break;
            case 'underline-end':
                appendResult('</u>');
                break;
            case 'superscript-end':
                appendResult('</sup>');
                break;
            case 'subscript-end':
                appendResult('</sub>');
                break;
            case 'unsafe-plain':
                appendResult(i.text);
                break;
                        case 'font-color-start':
                let fontColor = i.color;
                if (typeof fontColor === 'string') {
                    if (fontColor.includes(',')) {
                        const colors = fontColor.split(',');
                        const isDark = !document.body.classList.contains('light-mode');
                        fontColor = isDark ? (colors[1] || colors[0]) : colors[0];
                    }
                    fontColor = fontColor.trim();
                    if (!fontColor.startsWith('#') && /^[0-9a-fA-F]{3,6}$/.test(fontColor)) {
                        fontColor = '#' + fontColor;
                    }
                }
                appendResult(`<span style="color: ${fontColor}">`);
                break;
            case 'font-size-start':
                appendResult(`<span class="wiki-size-${i.level}-level">`);
                break;
            case 'font-color-end':
            case 'font-size-end':
                appendResult('</span>');
                break;
            case 'external-image':
                appendResult(`<img src="${i.target}" ${i.styleOptions ? "style=\"" + ObjToCssString(i.styleOptions) + '"' : ''}/>`)
                break;
            case 'comment':
                break; // 신경쓸 필요 X
            case 'heading-start':
                if(lastHeadingLevel < i.level)
                    hLevels[i.level]=0;
                lastHeadingLevel = i.level;
                hLevels[i.level]++;
                appendResult(`<h${i.level} id="heading-${++headingCount}"><a href="#wiki-toc">${hLevels[i.level]}. </a>`);
                isHeadingNow = true;
                headings.push({level: i.level, value: ''});
                break;
            case 'heading-end':
                isHeadingNow = false;
                appendResult(`</h${lastHeadingLevel}>`);
                break;
            case 'horizontal-line':
                appendResult('<hr>');
                break;
            case 'paragraph-start':
                appendResult('<p>');
                break;
            case 'paragraph-end':
                appendResult('</p>');
                break;
            case 'wiki-box-start':
                appendResult('<div ' + (i.style || '') + '>');
                break;
            case 'wiki-box-end':
                appendResult('</div>');
                break;
            case 'folding-start':
                appendResult('<details><summary>' + encodeHTMLComponent(i.summary) + '</summary>');
                break;
            case 'folding-end':
                appendResult('</details>');
                break;
        }
    }
    function finalLoop(callback) {
        let rendererResult = '';
        if(footnotes.length > 0) {
            _ht.processToken({name: 'macro', macroName: '각주'});
        }
        async.map(resultTemp, (item, mapcb) => {
            if(typeof item === "string") {
                mapcb(null, item);
            } else if(item && item.name === "macro") {
                switch(item.macroName) {
                    case 'toc':
                    case 'tableofcontents':
                    case '목차':
                        let macroContent = '<div class="wiki-toc" id="wiki-toc"><div class="wiki-toc-heading">목차</div>';
                        let hLevels = {1:0,2:0,3:0,4:0,5:0,6:0}, lastLevel = -1;
                        for(let j = 0; j < headings.length; j++) {
                            let curHeading = headings[j];
                            if(lastLevel != -1 && curHeading.level > lastLevel)
                                hLevels[curHeading.level] = 0;
                            hLevels[curHeading.level]++;
                            macroContent += `<div class="wiki-toc-item wiki-toc-item-indent-${curHeading.level}"><a href="#heading-${j+1}">${hLevels[curHeading.level]}.</a> ${curHeading.value}</div>`;
                            lastLevel = curHeading.level;
                        }
                        macroContent += '</div></div>';
                        return mapcb(null, macroContent);
                    case 'include':
                        if(typeof item.options === 'undefined' || item.options.length === 0)
                            return mapcb(null, '<span class="wikitext-syntax-error">오류 : Include 매크로는 최소한 include할 문서명이 필요합니다.</span>');
                        else if(typeof item.options[0] !== 'string')
                            return mapcb(null, '<span class="wikitext-syntax-error">오류 : include할 문서명이 첫번째로 매크로 매개변수로 전달되어야 합니다.</span>');
                        let childPage = new Namumark(item.options[0], options.includeParserOptions);
                        childPage.setIncluded();
                        if(item.options.length > 1) {
                            let incArgs = {};
                            for(let k = 1; k < item.options.length; k++) {
                                let incArg = item.options[k];
                                if(typeof incArg === 'string') continue;
                                incArgs[incArg.name] = incArg.value;
                            }
                            childPage.setIncludeParameters(incArgs);
                        }
                        childPage.setRenderer(null, options);
                        childPage.parse((e, r) => {if(e) mapcb(null, '[include 파싱/렌더링중 오류 발생]'); else mapcb(null, r.html); console.log('appened!');});
                        break;
                    default:
                        // Safe fallback: Release lock on unsupported macros
                        mapcb(null, '');
                        break;
                }
            } else {
                // Safe fallback: Release lock on other non-string tokens
                mapcb(null, item ? (item.text || JSON.stringify(item)) : '');
            }
        }, (err, finalFragments) => {
            if (err)
                return callback(err);
            let resultString = '';
            for(let i = 0; i < finalFragments.length; i++) {
                resultString += finalFragments[i];
            }
            callback(null, resultString);
        });
    }
    this.getResult = (c) => {
        finalLoop((err, html) => {
            if (err)
                return c(err);
            c(null, {html: html, categories: categories});
        })
    }
}

module.exports = HTMLRenderer;
});

define("defaultOptions", function(require, module, exports, __dirname, __filename) {
module.exports = {
    "wiki": {
        "read": (docName) => null // return null if not found, return content if found
    },
    "allowedExternalImageExts": ["jpg", "jpeg", "png", "gif"],
    "included": false,
    "includeParameters": {},
    "macroNames": ["br", "date", "목차", "tableofcontents", "각주", "footnote", "toc", "youtube", "include", "age", "dday"]
}
});

define("index", function(require, module, exports, __dirname, __filename) {
const defaultOptions = require('./defaultOptions.js'),
    extend = require('extend'),
    async = require('async'),
    {multiBrackets} = require('./rules'),
    redirectPattern = /^#(?:redirect|넘겨주기) (.+)$/im,
    {
        listParser,
        tableParser,
        blockquoteParser,
        bracketParser
    } = require('./parsers'),
    {
        seekEOL
    } = require('./helpers');

function Namumark(articleName, _options) {
    let options = extend(true, defaultOptions, _options),
        wikitext = options.wiki.read(articleName),
        rendererClass = require('./basicHTMLRenderer'),
        rendererOptions = null,
        renderer = null;

    function doParse(callback) {
        renderer = rendererOptions ? new rendererClass(rendererOptions) : new rendererClass();
        let line = '',
            now = '',
            tokens = [];
        if (wikitext === null)
            return [{name: "error", type: "notfound"}];
        if (wikitext.startsWith('#') && redirectPattern.test(wikitext) && redirectPattern.exec(wikitext).index === 0) {
            return [{name: "redirect", target: redirectPattern.exec(wikitext)[1]}];
        }
        for (let i = 0; i < wikitext.length; i++) {
            let temp = {
                pos: i
            };
            now = wikitext[i];
            if (line == '' && now == ' ' && (temp = listParser(wikitext, i, v => i = v))) {
                tokens = tokens.concat(temp);
                line = '';
                now = '';
                continue;
            }
            if (line == '' && wikitext.substring(i).startsWith('|') && (temp = tableParser(wikitext, i, v => i = v))) {
                tokens = tokens.concat(temp);
                line = '';
                now = '';
                continue;
            }
            if (line == '' && wikitext.substring(i).startsWith('>') && (temp = blockquoteParser(wikitext, i, v => i = v))) {
                tokens = tokens.concat(temp);
                line = '';
                now = '';
                continue;
            }
            for(let bracket of multiBrackets) {
                if(wikitext.substring(i).startsWith(bracket.open) && (temp = bracketParser(wikitext, i, bracket, v => i = v, callProcessor))){ // TO-DO r(n) = processor
                    tokens = tokens.concat([{name: "wikitext", treatAsLine: true, text:line}], temp);
                    line = '';
                    now = '';
                    break;
                }
            }
            if(now === '\n') {
                tokens = tokens.concat([{name: "wikitext", treatAsLine: true, text:line}]);
                line = '';
            } else
                line += now;
        }
        if(line.length != 0)
            tokens = tokens.concat([{name: "wikitext", treatAsLine: true, text:line}]);
        function processTokens(_p) {
            let newarr = JSON.parse(JSON.stringify(_p));
            for(let i = 0; i < newarr.length; i++) {
                let v = newarr[i];
                if(v.constructor.name === "Array")
                    processTokens(v);
                else if(v.name !== "wikitext")
                    renderer.processToken(v);
                else if(v.parseFormat || v.treatAsBlock)
                    processTokens(blockParser(v.text));
                else if(v.treatAsLine)
                    processTokens(lineParser(v.text));
            }
        }
        setImmediate(() => {processTokens(tokens); renderer.getResult((err, result) => {if(err)callback(err);else callback(null, result);})});
    }

    function callProcessor(processorName, args) {
        return require('./processors')[processorName](args[0], args[1], options)
    }

    function blockParser(line) { // = formatProcessor
        // NOTE : no attachment syntax support
        let result = [],
            {singleBrackets} = require('./rules'),
            plainTemp = "";
        for(let j = 0; j < line.length; j++) {
            const extImgPattern = new RegExp(`(https?:\\/\\/[^ \\n]+(?:\\??.)(?:${options.allowedExternalImageExts.join('|')}))(\\?[^ \n]+|)`, 'i'),
                extImgOptionPattern=/[&?](width|height|align)=(left|center|right|[0-9]+(?:%|px|))/;
            if(line.substring(j).startsWith('http') && extImgPattern.test(line) && extImgPattern.exec(line).index === 0) {
                let matches = extImgPattern.exec(line),
                    imgUrl = matches[1],
                    optionsString = matches[2],
                    optionMatches = extImgOptionPattern.exec(optionsString);
                
                let styleOptions = {};
                for(let k = 1; k < optionMatches.length; k++) {
                    let optionMatch = optionMatches[k];
                    styleOptions[optionMatch[1]] = optionMatch[2];
                }
                if(plainTemp.length !== 0) {
                    result.push({name: "plain", text: plainTemp})
                    plainTemp = "";
                }
                result.push({name: "external-image", style: styleOptions, target: imgUrl});
                j += matches[0].length - 1;
                continue;
            } else {
                let nj = JSON.parse(JSON.stringify(j)), matched = false;
                for(let k = 0; k < singleBrackets.length; k++) {
                    let bracket = singleBrackets[k], temp = null, innerStrLen = null;
                    if(line.substring(j).startsWith(bracket.open) && (temp = bracketParser(line, nj, bracket, v => nj = v, callProcessor, v => innerStrLen = v))){ // TO=DO : r(n) = call processor
                        if(plainTemp.length !== 0) {
                            result.push({name: "plain", text: plainTemp})
                            plainTemp = "";
                        }
                        result = result.concat(temp);
                        j += innerStrLen - 1;
                        matched = true;
                        break;
                    }
                }
                if(!matched) {
                    if(line[j] == '\n') {
                        result.push({name: "plain", text: plainTemp})
                        plainTemp = "";
                    } else {
                        plainTemp += line[j];
                    }
                }
            }
        }
        if(plainTemp.length != 0) {
            result.push({name: "plain", text: plainTemp});
            plainTemp = '';
        }
        return result;
    }

    function lineParser(line) {
        let result = [];
        const { headings }= require('./rules')

        // comment
        if(line.startsWith('##'))
            return [{name: "comment", text:line.substring(2)}];

        // title
        if(line.startsWith('=')) {
            for (let patternString in headings) {
                let pattern = new RegExp(patternString);
                if(pattern.test(line)) {
                    let level = headings[patternString];
                    return [{name: "heading-start", level: level}, {name: "wikitext", treatAsBlock: true, text: pattern.exec(line)[1]}, {name: "heading-end"}];
                }
            } 
        }

        // hr
        if(!/[^-]/.test(line) && line.length >= 4 && line.length <= 10) {
            return [{name: "horizontal-line"}];
        }

        if(line.length != 0)
            return [{name: "paragraph-start"}, blockParser(line), {name: "paragraph-end"}];
        else
            return [];
    }
    this.parse = c => {setImmediate(() => doParse(c))};
    this.setIncluded = () => {options.included = true;};
    this.setIncludeParameters = (paramsObj) => {options.includeParameters = paramsObj;};
    this.setRenderer = (r = null, o = null) => {if(r!==null)rendererClass = r; if(o!==null)rendererOptions = o; return;}
}
module.exports = Namumark;
});

define("helpers/index", function(require, module, exports, __dirname, __filename) {
exports.seekEOL = require('./seekEOL');
});

define("helpers/seekEOL", function(require, module, exports, __dirname, __filename) {
module.exports = function seekEOL(text, offset = 0) {
    return text.indexOf('\n', offset) == -1 ? text.length : text.indexOf('\n', offset);
}
});

define("parsers/blockquoteParser", function(require, module, exports, __dirname, __filename) {
let {seekEOL} = require('../helpers');
module.exports = (wikitext, pos, setpos) => {
    let i, temp = [], result = [];
    for(i = pos; i < wikitext.length; i = seekEOL(wikitext, i)+1) {
        let eol = seekEOL(wikitext, i);
        if(!wikitext.substring(i).startsWith(">"))
            break;
        let level = /^>+/.exec(wikitext.substring(i))[0].length,
            line = wikitext.substring(i + level, eol);
        temp.push({level: level, line: line});
    }
    if(temp.length == 0)
        return null;
    let curLevel = 1;
    result.push({name: "blockquote-start"})
    for(let i = 0; i < temp.length; i++) {
        let curTemp = temp[i];
        if(curTemp.level > curLevel) {
            for(let i = 0; i < curTemp.level - curLevel; i++)
                result.push({name: "blockquote-start"});
        } else if (curTemp.level < curLevel) {
            for(let i = 0; i < curLevel - curTemp.level; i++)
                result.push({name: "blockquote-end"});
        } else {
            result.push({name: "new-line"});
        }
        result.push({name: "wikitext", parseFormat: true, text: curTemp.line});
    }
    result.push({name: "blockquote-end"});
    setpos(i - 1);
    return result;
};
});

define("parsers/bracketParser", function(require, module, exports, __dirname, __filename) {
module.exports = (wikitext, pos, bracket, setpos, callproc, matchLenCallback = null) => {
    let cnt = 0, done = false;
    for(let i = pos; i < wikitext.length; i++) {
        if (wikitext.substring(i).startsWith(bracket.open) && !(bracket.open == bracket.close && cnt > 0)) {
            cnt++;
            done = true;
            i += bracket.open.length - 1;
        } else if(wikitext.substring(i).startsWith(bracket.close)) {
            cnt--;
            i += bracket.close.length - 1;
        } else if(!bracket.multiline && wikitext[i] === '\n')
            return null;
        
        if(cnt == 0 && done) {
            let innerString = wikitext.substring(pos + bracket.open.length, i - bracket.close.length + 1);
            if(matchLenCallback) {
                matchLenCallback(innerString.length + bracket.open.length + bracket.close.length);
            }
            setpos(i);
            return callproc(bracket.processor, [innerString, bracket.open]);
        }
    }
    return null;
}
});

define("parsers/index", function(require, module, exports, __dirname, __filename) {
exports.listParser = require('./listParser');
exports.tableParser = require('./tableParser');
exports.bracketParser = require('./bracketParser');
exports.blockquoteParser = require('./blockquoteParser');
});

define("parsers/listParser", function(require, module, exports, __dirname, __filename) {
let listTags = require('../rules').listTags,
    seekEOL = require('../helpers').seekEOL;

function finishTokens(tokens) {
    let result = [],
        prevListLevel = 0,
        prevIndentLevel = 0,
        prevWasList = false,
        prevListType;
    for (let i = 0; i < tokens.length; i++) {
        let curToken = tokens[i];
        let curWasList = curToken.name === 'list-item-temp';
        if (curWasList != prevWasList) {
            for (let j = 0; j < prevWasList ? prevListLevel : prevIndentLevel; j++)
                result.push({
                    name: prevWasList ? "list-end" : "indent-end"
                });
            if (prevWasList) prevListLevel = 0;
            else prevIndentLevel = 0;
        }
        switch (curToken.name) {
            case 'list-item-temp':
                if (prevListLevel < curToken.level) {
                    for (let j = 0; j < curToken.level - prevListLevel; j++)
                        result.push({
                            name: "list-start",
                            listType: curToken.listType
                        })
                } else if (prevListLevel > curToken.level) {
                    for (let j = 0; j < prevListLevel - curToken.level; j++)
                        result.push({
                            name: "list-end"
                        });
                } else if (prevListType.ordered !== curToken.listType.ordered || prevListType.type !== curToken.listType.type) {
                    result.push({
                        name: "list-end"
                    });
                    result.push({
                        name: "list-start",
                        listType: curToken.listType
                    });
                }
                prevListLevel = curToken.level;
                prevListType = curToken.listType;
                result.push({
                    name: "list-item-start",
                    startNo : curToken.startNo ? curToken.startNo : null
                });
                result.push({
                    name: "wikitext",
                    treatAsBlock: true,
                    text: curToken.wikitext
                });
                result.push({
                    name: "list-item-end"
                });
                break;
            case 'indent-temp':
                if (prevIndentLevel < curToken.level) {
                    for (let j = 0; j < curToken.level - prevIndentLevel; j++)
                        result.push({
                            name: "indent-start"
                        })
                } else if (prevIndentLevel > curToken.level) {
                    for (let j = 0; j < prevIndentLevel - curToken.level; j++)
                        result.push({
                            name: "indent-end"
                        });
                }
                prevIndentLevel = curToken.level;
                result.push({
                    name: "wikitext",
                    treatAsBlock: true,
                    text: curToken.wikitext
                });
        }
        if (i === tokens.length - 1) {
            if (curWasList) {
                for (let j = 0; j < prevListLevel; j++)
                    result.push({
                        name: "list-end"
                    });
            } else {
                for (let j = 0; j < prevIndentLevel; j++)
                    result.push({
                        name: "indent-end"
                    });
            }
        }
        prevWasList = curWasList;
    }
    return result;
}
module.exports = (wikitext, pos, setpos) => {
    let lineStart = pos,
        result = [],
        isList = null,
        i = pos;
    for (; i++; i < wikitext.length) {
        let char = wikitext[i];
        if (char != ' ') {
            if (lineStart === i)
                break;
            let level = i - lineStart,
                matched = false,
                quit = false,
                eol = seekEOL(wikitext, i),
                innerString = wikitext.substring(i, eol);
            for (let j in listTags) {
                let listTagInfo = listTags[j];
                innerString = wikitext.substring(i + j.length, eol);
                let startNoSpecifiedPattern = new RegExp(j.replace(/\./g, '\\.').replace(/\*/g, '\\*') + '#([0-9]+)'); // 1.#32 와 같이 시작번호를 지정하는 문법
                if (wikitext.substring(i).startsWith(j)) {
                    if(isList === null)
                        isList = true;
                    else if(!isList) {
                        quit = true;
                        break;
                    }
                    matched = true;
                    if (startNoSpecifiedPattern.test(wikitext.substring(i))) {
                        let startNo = parseInt(startNoSpecifiedPattern.exec(wikitext.substring(i))[1]);
                        innerString = innerString.replace(/^#[0-9]+/, '');
                        result.push({
                            name: "list-item-temp",
                            listType: listTagInfo,
                            level: level,
                            startNo: startNo,
                            wikitext: innerString
                        });
                    } else {
                        result.push({
                            name: "list-item-temp",
                            listType: listTagInfo,
                            level: level,
                            wikitext: innerString
                        });
                    }
                    i = eol;
                    lineStart = eol + 1;
                    break;
                }
            }
            if(quit) {
                i = lineStart;
                break;
            }
            if (!matched) {
                if(isList === null) {
                    isList = false;
                } else if(isList) {
                    i = lineStart;
                    break;
                }
                result.push({
                    name: "indent-temp",
                    level: level,
                    wikitext: innerString
                });
                i = eol;
                char = "\n";
            }
        }
        if (char == '\n')
            lineStart = i + 1;
    }
    if (result.length === 0)
        result = null;
    else{
        result = finishTokens(result);
        setpos(i - 1);
    }
    return result;
}
});

define("parsers/tableParser", function(require, module, exports, __dirname, __filename) {
const extend = require('extend');

function parseOptionBracket(optionContent) {
    let colspan = 0, rowspan = 0, colOptions = {}, tableOptions = {}, rowOptions = {}, matched = false;
    if (/^-[0-9]+$/.test(optionContent)) {
        // 가로 합치기
        colspan += parseInt(/^-([0-9]+)$/.exec(optionContent)[1]);
        matched = true;
    } else if (/^\|[0-9]+$/.test(optionContent) || /^\^\|([0-9]+)$/.test(optionContent) || /^v\|([0-9]+)$/.test(optionContent)) {
        // 세로 합치기
        rowspan += parseInt(/^\|([0-9]+)$/.exec(optionContent)[1] || /^\^\|([0-9]+)$/.exec(optionContent)[1] || /^v\|([0-9]+)$/.exe(optionContent)[1]);
        matched = true;
        if (/^\^\|([0-9]+)$/.test(optionContent))
            colOptions["vertical-align"] = "top";
        else if (/^v\|([0-9]+)$/.test(optionContent))
            colOptions["vertical-align"] = "bottom";
        else if (/^\|([0-9]+)$/.test(optionContent))
            colOptions["vertical-align"] = "middle";
    } else if (optionContent.startsWith("table ")) {
        // 테이블 설정
        let tableOptionContent = optionContent.substring(6);
        let tableOptionPatterns = {
            "align": /^align=(left|center|right)$/,
            "background-color": /^bgcolor=((?:#[a-zA-Z0-9]{3,6}|[a-zA-Z]+)(?:,(?:#[a-zA-Z0-9]{3,6}|[a-zA-Z]+))?)$/,
            "color": /^color=((?:#[a-zA-Z0-9]{3,6}|[a-zA-Z]+)(?:,(?:#[a-zA-Z0-9]{3,6}|[a-zA-Z]+))?)$/,
            "border-color": /^bordercolor=((?:#[a-zA-Z0-9]{3,6}|[a-zA-Z]+)(?:,(?:#[a-zA-Z0-9]{3,6}|[a-zA-Z]+))?)$/,
            "width": /^width=([0-9]+(?:in|pt|pc|mm|cm|px))$/
        };
        for (let optionName in tableOptionPatterns) {
            if (tableOptionPatterns[optionName].test(tableOptionContent)) {
                tableOptions[optionName] = tableOptionPatterns[optionName].exec(tableOptionContent)[1];
                matched = true;
            }
        }
    } else {
        // 셀 옵션 패턴 (매개변수 X)
        let textAlignCellOptions = {
            "left": /^\($/,
            "middle": /^:$/,
            "right": /^\)$/
        };
        // 셀 옵션 패턴 (매개변수 O)
        let paramlessCellOptions = {
            "background-color": /^bgcolor=((?:#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+)(?:,(?:#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+))?)$/,
            "row-background-color": /^rowbgcolor=((?:#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+)(?:,(?:#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+))?)$/,
            "color": /^color=((?:#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+)(?:,(?:#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+))?)$/,
            "width": /^width=([0-9]+(?:in|pt|pc|mm|cm|px|%))$/,
            "height": /^height=([0-9]+(?:in|pt|pc|mm|cm|px|%))$/
        }
        for (let i in textAlignCellOptions) {
            if (textAlignCellOptions[i].test(optionContent)) {
                colOptions["text-align"] = optionContent;
                matched = true;
            }
            else
                for (let optionName in paramlessCellOptions) {
                    if(!paramlessCellOptions[optionName].test(optionContent))
                        continue;
                    if(optionName.startsWith("row-"))
                        rowOptions[optionName.substring(4)] = paramlessCellOptions[optionName].exec(optionContent)[1];
                    else
                        colOptions[optionName] = paramlessCellOptions[optionName].exec(optionContent)[1];
                    matched = true;
                }
        }
    }
    // colspan_add = 0, rowspan_add = 0, colOptions = {}, tableOptions = {};
    return {colspan_add: colspan, rowspan_add: rowspan, colOptions_set: colOptions, rowOptions_set: rowOptions, tableOptions_set: tableOptions, matched: matched};
};
module.exports = (wikitext, pos, setpos) => {
    // 시발 표 존나 복잡하네
    // 버그 : || 2행이 {{{ || }}} 되어야 하는데 || 3행으로 됨 ㅋ ||
    let caption = null;
    if (!wikitext.substring(pos).startsWith('||')) {
        caption = wikitext.substring(pos + 1, wikitext.indexOf('|', pos + 2));
        pos = wikitext.indexOf('|', pos + 1) + 1;
        console.log(caption);
    } else {
        pos += 2;
    }
    let cols = wikitext.substring(pos).split('||'),
        rowno = 0,
        hasTableContent = false,
        colspan = 0,
        rowspan = 0;
    let optionPattern = /<(.+?)>/;
    console.log(cols);
    let table = {
        0: []
    };
    let tableOptions = {};
    // parse cols, result= {wikitext, options, rowOptions} => table
    let i;
    if(cols.length < 2)
        return null;
    for (i = 0; i < cols.length; i++) {
        let col = cols[i],
            curColOptions = {},
            rowOption = {};
        if (col.startsWith('\n') && col.length > 1) {
            // table end
            break;
        }
        if (col == '\n') {
            // new row
            table[++rowno] = [];
            continue;
        }
        if (col.length == 0) {
            // 이런 형식의 열 합치기 : |||||| 합쳐진 열 ||
            colspan++;
            continue;
        }
        // 가사 표의 완결성을 위해 모든 셀은 기본 가운데 정렬(center)로 정렬 방향을 고정한다!
        curColOptions["text-align"] = "center";
        while (optionPattern.test(col)) {
            // 옵션이 존재함.
            let match = optionPattern.exec(col);
            if (match.index != 0)
                break; // 옵션이 아님 ||<|2> 이건 옵션이지만 || <|2> 이렇게 중간에 뭐라도 있으면 옵션으로 간주 안함. (더시드위키 테스트 결과)
            let optionContent = match[1];
            let {colOptions_set, tableOptions_set, colspan_add, rowspan_add, rowOptions_set, matched} = parseOptionBracket(optionContent);
            curColOptions = extend(true, curColOptions, colOptions_set);
            tableOptions = extend(true, tableOptions, tableOptions_set);
            rowOptions_set = extend(true, rowOption, rowOptions_set);
            colspan += colspan_add;
            rowspan += rowspan_add;

            if (tableOptions["border-color"]) {
                tableOptions["border"] = `2px solid ${tableOptions["border-color"]}`;
                delete tableOptions["border-color"];
            }
            //if (matched) {
                col = col.substring(match[0].length);
            //}
        }
        let colObj = {options: curColOptions, colspan: colspan, rowspan: rowspan, rowOption: rowOption, wikitext: col};
        colspan = 0; rowspan = 0;
        table[rowno].push(colObj);
        hasTableContent = true;
    }
    // gen row options
    let rowOptions = [];
    let rowCount = Object.keys(table).length;
    for (let j = 0; j < rowCount; j++) {
        let rowOption = {};
        if (table[j]) {
            for(let k = 0; k < table[j].length; k++) {
                rowOption = extend(true, rowOption, table[j][k].rowOption);
            }
        }
        rowOptions.push(rowOption);
    }
    // return as tokens
    let result = [{name:"table-start", options: tableOptions}];
    for (let j = 0; j < rowCount; j++) {
        result.push({name: "table-row-start", options: rowOptions[j]});
        for(let k = 0; k < table[j].length; k++) {
            result.push({name: "table-col-start", options: table[j][k].options, colspan: table[j][k].colspan, rowspan: table[j][k].rowspan});
            result.push({name: "wikitext", text: table[j][k].wikitext, treatAsLine: true});
            result.push({name: "table-col-end"});
        }
        result.push({name:"table-row-end"});
    }
    result.push({name:"table-end"});
    if(hasTableContent) {
        setpos(pos + cols.slice(0, i).join('||').length + 1)
        return result;
    } else {
        return null;
    }
};
});

define("processors/closureProcessor", function(require, module, exports, __dirname, __filename) {
module.exports = (text, type) => {
    return [{name: "closure-start"}, {name: "wikitext", parseFormat: true, text: text}, {name: "closure-end"}];
}
});

define("processors/index", function(require, module, exports, __dirname, __filename) {
exports.closureProcessor = require('./closureProcessor');
exports.linkProcessor = require('./linkProcessor');
exports.macroProcessor = require('./macroProcessor');
exports.renderProcessor = require('./renderProcessor');
exports.textProcessor = require('./textProcessor');
});

define("processors/linkProcessor", function(require, module, exports, __dirname, __filename) {
module.exports = (text, type, configs) => {
    let href = text.split('|');
    if (/^https?:\/\//.test(text)) {
        return [{
            name: "link-start",
            external: true,
            target: href[0]
        }, {
            name: href.length > 1 ? "wikitext" : "plain",
            parseFormat: true,
            text: href.length > 1 ? href[1] : href[0]
        }, {
            name: "link-end"
        }];
    } else if (/^분류:(.+)$/.test(href[0])) {
        let category = /^분류:(.+)$/.exec(href[0])[1];
        if (!configs.included)
            return [{
                name: "add-category",
                blur: href[0].endsWith('#blur'),
                categoryName: category
            }];
    } else if (/^파일:(.+)$/.test(href[0])) {
        let fileOpts = {},
            haveOpts = false;
        if (href.length > 1) {
            let pattern = /[&?]?(^[=]+)=([^\&]+)/g,
                match = null;
            while (match = pattern.exec(href[1])) {
                if ((match[1] === 'width' || match[1] === 'height') && /^[0-9]$/.test(match[2])) {
                    match[2] = match[2] + 'px';
                }
                fileOpts[match[1]] = match[2];
                haveOpts = true;
            }
        }
        if (haveOpts) {
            return [{
                name: "image",
                target: /^파일:(.+)$/.exec(href[0])[1]
            }];
        } else {
            return [{
                name: "image",
                target: /^파일:(.+)$/.exec(href[0])[1],
                options: fileOpts
            }];
        }
    } else {
        if (href[0].startsWith(' ') || href[0].startsWith[':']) {
            href[0] = href[0].substring(1);
        }
        return [{
            name: "link-start",
            internal: true,
            target: href[0]
        }, href.length > 1 ? {
            name: "wikitext",
            parseFormat: true,
            text: href[1]
        } : {
            name: "plain",
            text: href[0]
        }, {
            name: "link-end"
        }];
    }
};
});

define("processors/macroProcessor", function(require, module, exports, __dirname, __filename) {
module.exports = (text, type, configs) => {
    let defaultResult = [{name: "plain", text: `[${text}]`}];
    if (text.startsWith('*') && /^\*([^ ]*) (.+)$/.test(text)) {
        let matches = /^\*([^ ]*) (.+)$/.exec(text);
        return [{
            name: "footnote-start",
            supText: matches[1].length === 0 ? null : matches[1]
        }, {
            name: "wikitext",
            treatAsBlock: true,
            text: matches[2]
        }, {
            name: "footnote-end"
        }];
    } else {
        if(/^[^\(]+$/.test(text)) {
            if(configs.macroNames.indexOf(text) == -1)
                return defaultResult;
            else
                return [{name: "macro", macroName: text}];
        } else if(/^([^\(]+)\((.*)\)/.test(text)){
            let matches = /^([^\(]+)\((.*)\)/.exec(text);
            if(configs.macroNames.indexOf(matches[1]) == -1)
                return defaultResult;
            let macroName = matches[1], 
                optionSplitted = matches[2].split(','),
                options = [];
            if(matches[2].length != 0) {
                for(let i of optionSplitted) {
                    if(i.indexOf('=') == -1) {
                        options.push(i);
                    } else {
                        options.push({name: i.split('=')[0], value: i.split('=')[1]});
                    }
                }
            }
            return [{name: "macro", macroName: macroName, options: options}];
        }
        return defaultResult;
    }
}
});

define("processors/renderProcessor", function(require, module, exports, __dirname, __filename) {
module.exports = (text, type) => {
    if (/^#!html/i.test(text)) {
        return [{
            name: "unsafe-plain",
            text: text.substring(6)
        }];
    } else if (/^#!folding/i.test(text) && text.indexOf('\n') >= 10) {
        return [{
                name: "folding-start",
                summary: text.substring(10, text.indexOf('\n'))
            }, {
                name: "wikitext",
                treatAsBlock: true,
                text: text.substring(text.indexOf('\n') + 1)
            },
            {
                name: "folding-end"
            }
        ];
    } else if (/^#!syntax/i.test(text) && text.indexOf('\n') >= 9) {
        return [{
            name: "syntax-highlighting",
            header: text.substring(9, text.indexOf('\n')),
            body: text.substring(text.indexOf('\n') + 1)
        }];
    } else if (/^#!wiki/i.test(text)) {
        if (text.indexOf('\n') >= 7) {
            let params = text.substring(7, text.indexOf('\n'));
            if (params.startsWith("style=\"") && /" +$/.test(params)) {
                return [{
                    name: "wiki-box-start",
                    style: params.substring(7, params.length - /" +$/.exec(params)[0].length)
                }, {
                    name: "wikitext",
                    treatAsBlock: true,
                    text: text.substring(text.indexOf('\n') + 1)
                }, {
                    name: "wiki-box-end"
                }]
            } else {
                return [{
                    name: "wiki-box-start"
                }, {
                    name: "wikitext",
                    treatAsBlock: true,
                    text: text.substring(text.indexOf('\n') + 1)
                }, {
                    name: "wiki-box-end"
                }]

            }
        }
    } else if (/^#([A-Fa-f0-9]{3,6}) (.*)$/.test(text)) {
        let matches = /^#([A-Fa-f0-9]{3,6}) (.*)$/.exec(text);
        if (matches[1].length === 0 && matches[2].length === 0)
            return [{
                name: "plain",
                text: text
            }];
        return [{
            name: "font-color-start",
            color: matches[1]
        }, {
            name: "wikitext",
            parseFormat: true,
            text: matches[2]
        }, {
            name: "font-color-end"
        }];
    } else if (/^\+([1-5]) (.*)$/.test(text)) {
        let matches = /^\+([1-5]) (.*)$/.exec(text);
        return [{
            name: "font-size-start",
            level: matches[1]
        }, {
            name: "wikitext",
            parseFormat: true,
            text: matches[2]
        }, {
            name: "font-size-end"
        }];
    };
    return [{
        name: "monoscape-font-start",
        pre: true
    }, {
        name: "plain",
        text: text.substring(1)
    }, {
        name: "monoscape-font-end"
    }];
}
});

define("processors/textProcessor", function(require, module, exports, __dirname, __filename) {
module.exports = (text, type, options) => {
    let styles = {
        "'''": "strong",
        "''": "italic",
        "--": "strike",
        "~~": "strike",
        "__": "underline",
        "^^": "superscript",
        ",,": "subscript"
    }
    switch(type) {
        case "'''":
        case "''":
        case "--":
        case "~~":
        case "__":
        case "^^":
        case ",,":
            return [{name: `${styles[type]}-start`}, {name: "wikitext", parseFormat: true, text: text}, {name: `${styles[type]}-end`}];
        case "{{{":
            if(text.startsWith('#!html')) {
                return [{name: "unsafe-plain", text: text.substring(6)}];
            } else if(/^#([A-Fa-f0-9]{3,6}) (.*)$/.test(text)) {
                let matches = /^#([A-Fa-f0-9]{3,6}) (.*)$/.exec(text);
                if(matches[1].length === 0 && matches[2].length === 0)
                    return [{name: "plain", text: text}];
                return [{name: "font-color-start", color: matches[1]}, {name: "wikitext", parseFormat: true, text: matches[2]}, {name: "font-color-end"}];
            } else if(/^\+([1-5]) (.*)$/.test(text)) {
                let matches = /^\+([1-5]) (.*)$/.exec(text);
                return [{name: "font-size-start", level: matches[1]}, {name: "wikitext", parseFormat: true, text: matches[2]}, {name: "font-size-end"}];
            };
            return [{name: "monoscape-font-start"}, {name: "plain", text: text}, {name: "monoscape-font-end"}]
        case "@":
            if(!options.included)
                break;
            if(Object.keys(options.includeParameters).indexOf(text) != -1)
                return [{name: "wikitext", parseFormat: true, text: options.includeParameters[text]}];
            else
                return null;
    }
    return [{name: "plain", text: `${type}${text}${type}`}];
}
});

define("rules/decorations", function(require, module, exports, __dirname, __filename) {
let formats = ["'''", "''", "~~", "--", "__", "^^", ",,"],
    result = [];
for(let i = 0; i < formats.length; i++) {
    result.push({
        open: formats[i],
        close: formats[i],
        multiline: false,
        processor: 'textProcessor'
    })
}
module.exports = result;
});

define("rules/headings", function(require, module, exports, __dirname, __filename) {
let headings = {};
headings["^= (.+) =$"] = 1;
headings["^== (.+) ==$"] = 2;
headings["^=== (.+) ===$"] = 3;
headings["^==== (.+) ====$"] = 4;
headings["^===== (.+) =====$"] = 5;
headings["^====== (.+) ======$"] = 6;
module.exports = headings;
});

define("rules/index", function(require, module, exports, __dirname, __filename) {
exports.headings = require('./headings.js');
exports.singleBrackets = require('./singleBrackets.js').concat(require('./decorations.js'));
exports.multiBrackets = require('./multiBrackets.js');
exports.listTags = require('./listTags.js');
});

define("rules/listTags", function(require, module, exports, __dirname, __filename) {
module.exports = {
    "*": {ordered: false},
    "1.": {ordered: true, type: 'decimal'},
    "A.": {ordered: true, type: 'upper-alpha'},
    "a.": {ordered: true, type: 'lower-alpha'},
    "I.": {ordered: true, type: 'upper-roman'},
    "i.": {ordered: true, type: 'lower-roman'}
}
});

define("rules/multiBrackets", function(require, module, exports, __dirname, __filename) {
module.exports = [{
    open: '{{{',
    close: '}}}',
    multiline: true,
    processor: 'renderProcessor'
}];
});

define("rules/singleBrackets", function(require, module, exports, __dirname, __filename) {
module.exports = [{
    open: '{{{',
    close: '}}}',
    multiline: false,
    processor: 'textProcessor'
}, {
    open: '{{|',
    close: '|}}',
    multiline: false,
    processor: 'closureProcessor'
}, {
    open: '[[',
    close: ']]',
    multiline: false,
    processor: 'linkProcessor'
}, {
    open: '[',
    close: ']',
    multiline: false,
    processor: 'macroProcessor'
}, {
    open: '@',
    close: '@',
    multiline: false,
    processor: 'textProcessor'
}]
});



    global.Namumark.Renderers = {
        HTML: loadModule('basicHTMLRenderer')
    };
})(window);