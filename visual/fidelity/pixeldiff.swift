import AppKit

/// A decoded screenshot: its size and RGBA bytes.
struct Image {
    let width: Int
    let height: Int
    let pixels: [UInt8]
}

/// Decodes the PNG at `path` into RGBA bytes, or nil when it cannot be read.
func load(_ path: String) -> Image? {
    guard let data = FileManager.default.contents(atPath: path),
          let rep = NSBitmapImageRep(data: data),
          let cg = rep.cgImage else {
        return nil
    }
    let width = cg.width
    let height = cg.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard let context = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        return nil
    }
    context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
    return Image(width: width, height: height, pixels: pixels)
}

/// Writes RGBA bytes as a PNG.
func save(_ pixels: [UInt8], width: Int, height: Int, to path: String) {
    var bytes = pixels
    guard let context = CGContext(data: &bytes, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue),
          let cg = context.makeImage() else {
        return
    }
    let rep = NSBitmapImageRep(cgImage: cg)
    if let data = rep.representation(using: .png, properties: [:]) {
        try? data.write(to: URL(fileURLWithPath: path))
    }
}

/// The part of `image` at (x, y) of size w by h, in pixels, or nil when it does not lie inside the image.
func crop(_ image: Image, x: Int, y: Int, w: Int, h: Int) -> Image? {
    guard x >= 0, y >= 0, w > 0, h > 0, x + w <= image.width, y + h <= image.height else {
        return nil
    }
    var out = [UInt8](repeating: 0, count: w * h * 4)
    for row in 0..<h {
        let from = ((y + row) * image.width + x) * 4
        out.replaceSubrange((row * w * 4)..<((row + 1) * w * 4), with: image.pixels[from..<(from + w * 4)])
    }
    return Image(width: w, height: h, pixels: out)
}

/// Compares two screenshots pixel by pixel. A pixel differs when any channel is off by more than `tolerance`.
/// Prints `{width, height, differing, total, percent, maxDelta, sizeMismatch}` as JSON and writes a heatmap
/// (the design faded, every differing pixel red) to the third argument. Four more arguments (x, y, width, height in
/// pixels) compare only that part of each screenshot, for a case whose root is not the whole page.
func main() {
    let arguments = CommandLine.arguments
    guard arguments.count == 5 || arguments.count == 9, let tolerance = Int(arguments[4]) else {
        FileHandle.standardError.write(Data("usage: pixeldiff <design.png> <app.png> <heatmap.png> <tolerance> [x y width height]\n".utf8))
        exit(2)
    }
    guard var design = load(arguments[1]), var app = load(arguments[2]) else {
        FileHandle.standardError.write(Data("could not read a screenshot\n".utf8))
        exit(1)
    }
    if arguments.count == 9 {
        let box = arguments[5...8].compactMap { Int($0) }
        guard box.count == 4, let croppedDesign = crop(design, x: box[0], y: box[1], w: box[2], h: box[3]),
              let croppedApp = crop(app, x: box[0], y: box[1], w: box[2], h: box[3]) else {
            FileHandle.standardError.write(Data("the case root does not lie inside the screenshots\n".utf8))
            exit(1)
        }
        design = croppedDesign
        app = croppedApp
    }
    if design.width != app.width || design.height != app.height {
        print("{\"sizeMismatch\":true,\"design\":[\(design.width),\(design.height)],\"app\":[\(app.width),\(app.height)],\"percent\":100,\"differing\":-1,\"total\":-1,\"maxDelta\":255}")
        return
    }
    var heat = [UInt8](repeating: 255, count: design.pixels.count)
    var differing = 0
    var maxDelta = 0
    for i in stride(from: 0, to: design.pixels.count, by: 4) {
        var delta = 0
        for c in 0..<3 {
            delta = max(delta, abs(Int(design.pixels[i + c]) - Int(app.pixels[i + c])))
        }
        maxDelta = max(maxDelta, delta)
        if delta > tolerance {
            differing += 1
            heat[i] = 230; heat[i + 1] = 40; heat[i + 2] = 40
        } else {
            for c in 0..<3 {
                heat[i + c] = UInt8(255 - (255 - Int(design.pixels[i + c])) / 4)
            }
        }
    }
    save(heat, width: design.width, height: design.height, to: arguments[3])
    let total = design.width * design.height
    let percent = Double(differing) * 100 / Double(total)
    print("{\"sizeMismatch\":false,\"width\":\(design.width),\"height\":\(design.height),\"differing\":\(differing),\"total\":\(total),\"percent\":\(percent),\"maxDelta\":\(maxDelta)}")
}

main()
