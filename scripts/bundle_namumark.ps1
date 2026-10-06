# PowerShell Bundle Script for js-namumark

$srcDir = "C:\Users\kangd\.gemini\antigravity\brain\17f6b83c-ba99-42e6-9602-43cb9d91aa37\scratch\js-namumark-master"
$destFile = "C:\Users\kangd\Documents\antigravity\wonderful-pasteur\namumark.js"

# Write the Module Loader and Mock Dependencies Header
$bundleHeader = @'
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
'@

# Start gathering modules
Write-Host "Bundling js-namumark from $srcDir to $destFile ..."
$modulesCode = New-Object System.Text.StringBuilder

# Find all JS files in source except test directory
$jsFiles = Get-ChildItem -Path $srcDir -Filter "*.js" -Recurse | Where-Object { $_.FullName -notlike "*\test\*" -and $_.Name -ne "package.json" }

foreach ($file in $jsFiles) {
    # Compute relative path and normalize it as module name
    $relPath = $file.FullName.Substring($srcDir.Length + 1)
    $moduleName = $relPath.Replace("\", "/")
    if ($moduleName.EndsWith(".js")) {
        $moduleName = $moduleName.Substring(0, $moduleName.Length - 3)
    }
    
    Write-Host "Processing module: $moduleName"
    
    # Read file content explicitly in UTF-8
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # Custom Hook: If it is basicHTMLRenderer.js, apply our HTML formatting fixes and dual color hooks
    if ($moduleName -eq "basicHTMLRenderer") {
        Write-Host "Applying hooks to basicHTMLRenderer..."
        
        # 1. Hook ObjToCssString to split dual colors based on theme
        $customObjToCssString = @'
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
'@
        $content = $content -replace 'function ObjToCssString\(obj\) \{[\s\S]+?return styleString.substring\(0, styleString.length - 1\);\s*\}', $customObjToCssString

        # 2. Hook case 'font-color-start' to fix raw missing closing quote and split colors
        $customFontColorStart = @'
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
'@
        $content = $content -replace 'case ''font-color-start'':\s*appendResult\(`.*color: \${i.color}>`\);\s*break;', $customFontColorStart
    }
    
    # Wrap in our module registry
    [void]$modulesCode.AppendLine("define(`"$moduleName`", function(require, module, exports, __dirname, __filename) {")
    [void]$modulesCode.AppendLine($content)
    [void]$modulesCode.AppendLine("});`n")
}

# Assemble final file
$bundleFooter = @"

    global.Namumark.Renderers = {
        HTML: loadModule('basicHTMLRenderer')
    };
})(window);
"@

$finalBundle = $bundleHeader + "`n" + $modulesCode.ToString() + "`n" + $bundleFooter
[System.IO.File]::WriteAllText($destFile, $finalBundle, [System.Text.Encoding]::UTF8)

Write-Host "Namumark bundle successfully created at $destFile"
