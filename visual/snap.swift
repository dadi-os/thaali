import AppKit
import WebKit

/// One step of a capture: exactly one field is set.
struct Step: Decodable {
    var eval: String?
    var wait: Int?
    var shot: String?
    var click: String?
    var hover: String?
    var checks: String?
}

/// One page to load at one size, then walk through `steps`.
struct Job: Decodable {
    var name: String
    var url: String
    var width: Int
    var height: Int
    var settleMs: Int
    var steps: [Step]
}

/// The whole run: where screenshots go, the DOM-check script, and the jobs.
struct Plan: Decodable {
    var outDir: String
    var hookScript: String
    var checksScript: String
    var jobs: [Job]
}

/// Resumes the waiting capture once the page has loaded or failed to.
final class Loader: NSObject, WKNavigationDelegate {
    var finished: CheckedContinuation<Void, Never>?
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        finished?.resume()
        finished = nil
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        FileHandle.standardError.write(Data("navigation failed: \(error)\n".utf8))
        finished?.resume()
        finished = nil
    }
}

/// Evaluates `code` in the page and returns its value, or an `ERR:` string when it throws.
@MainActor
func js(_ webView: WKWebView, _ code: String) async -> Any? {
    await withCheckedContinuation { continuation in
        webView.evaluateJavaScript(code) { value, error in
            continuation.resume(returning: error == nil ? value : "ERR: \(error!)")
        }
    }
}

/// Writes a screenshot of the page (at the screen's pixel density) to `path`.
@MainActor
func png(_ webView: WKWebView, to path: String) async {
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
        webView.takeSnapshot(with: WKSnapshotConfiguration()) { image, _ in
            if let tiff = image?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
               let data = rep.representation(using: .png, properties: [:]) {
                try? data.write(to: URL(fileURLWithPath: path))
            }
            continuation.resume()
        }
    }
}

/// Moves the pointer over the first element matching `selector`, so its `:hover` styles apply.
@MainActor
func hover(_ window: NSWindow, _ webView: WKWebView, selector: String, height: Int) async {
    let center = await js(webView, "(() => { const el = document.querySelector(\(selector.debugDescription)); if (!el) return null; const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()")
    guard let point = center as? [Double], point.count == 2 else {
        return
    }
    let location = NSPoint(x: point[0], y: Double(height) - point[1])
    if let event = NSEvent.mouseEvent(with: .mouseMoved, location: location, modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 0, pressure: 0) {
        window.sendEvent(event)
    }
}

/// Loads each job's page at its size, performs its steps and returns one result per job: shots, DOM-check reports, eval values and console errors.
@MainActor
func run(_ plan: Plan) async -> [[String: Any]] {
    let checks = (try? String(contentsOfFile: plan.checksScript, encoding: .utf8)) ?? ""
    let hook = (try? String(contentsOfFile: plan.hookScript, encoding: .utf8)) ?? ""
    precondition(!checks.isEmpty && !hook.isEmpty, "hook and checks scripts must be readable")
    var results: [[String: Any]] = []
    try? FileManager.default.createDirectory(atPath: plan.outDir, withIntermediateDirectories: true)
    for job in plan.jobs {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.addUserScript(WKUserScript(source: hook, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let frame = NSRect(x: 0, y: 0, width: job.width, height: job.height)
        let webView = WKWebView(frame: frame, configuration: config)
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: job.width, height: job.height), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = webView
        window.acceptsMouseMovedEvents = true
        window.alphaValue = 0.01
        window.ignoresMouseEvents = true
        window.level = .normal
        window.orderFrontRegardless()
        let loader = Loader()
        webView.navigationDelegate = loader
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            loader.finished = continuation
            webView.load(URLRequest(url: URL(string: job.url)!))
        }
        try? await Task.sleep(for: .milliseconds(job.settleMs))
        var result: [String: Any] = ["name": job.name, "url": job.url, "width": job.width, "height": job.height]
        var shots: [String] = []
        var reports: [[String: Any]] = []
        var evals: [Any] = []
        for step in job.steps {
            if let ms = step.wait {
                try? await Task.sleep(for: .milliseconds(ms))
            } else if let code = step.eval {
                evals.append(await js(webView, code) ?? NSNull())
            } else if let selector = step.click {
                evals.append(await js(webView, "(() => { const el = document.querySelector(\(selector.debugDescription)); if (!el) return 'missing'; el.click(); return 'clicked'; })()") ?? NSNull())
            } else if let selector = step.hover {
                await hover(window, webView, selector: selector, height: job.height)
            } else if let file = step.shot {
                let path = "\(plan.outDir)/\(file)"
                await png(webView, to: path)
                shots.append(path)
            } else if let label = step.checks {
                _ = await js(webView, checks)
                if let json = await js(webView, "JSON.stringify(window.__runChecks())") as? String,
                   let data = json.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    var report = parsed
                    report["label"] = label
                    reports.append(report)
                }
            }
        }
        result["shots"] = shots
        result["checks"] = reports
        result["evals"] = evals
        result["errors"] = (await js(webView, "window.__errs") as? [String]) ?? []
        results.append(result)
        window.orderOut(nil)
        webView.stopLoading()
    }
    return results
}

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
    FileHandle.standardError.write(Data("usage: snap <plan.json> <results.json>\n".utf8))
    exit(2)
}
let plan = try JSONDecoder().decode(Plan.self, from: Data(contentsOf: URL(fileURLWithPath: arguments[1])))
let application = NSApplication.shared
application.setActivationPolicy(.accessory)
Task { @MainActor in
    let results = await run(plan)
    do {
        let data = try JSONSerialization.data(withJSONObject: results, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: URL(fileURLWithPath: arguments[2]))
    } catch {
        FileHandle.standardError.write(Data("could not write results: \(error)\n".utf8))
        exit(1)
    }
    exit(0)
}
application.run()
