#!/usr/bin/env swift

import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count >= 3 else {
  FileHandle.standardError.write(
    Data("Usage: generate-mac-icons.swift <source-png> <resources-dir>\n".utf8),
  )
  exit(1)
}

let sourceURL = URL(fileURLWithPath: arguments[1])
let resourcesURL = URL(fileURLWithPath: arguments[2])
let fileManager = FileManager.default

guard let sourceImage = NSImage(contentsOf: sourceURL) else {
  FileHandle.standardError.write(Data("Unable to read source image: \(sourceURL.path)\n".utf8))
  exit(1)
}

func makeIcon(size: Int) throws -> NSBitmapImageRep {
  let iconSize = NSSize(width: size, height: size)
  let canvasRect = NSRect(origin: .zero, size: iconSize)
  let inset = CGFloat(size) * 0.09
  let iconRect = canvasRect.insetBy(dx: inset, dy: inset)
  let radius = iconRect.width * 0.225
  let sourceRect = NSRect(origin: .zero, size: sourceImage.size)

  guard
    let bitmap = NSBitmapImageRep(
      bitmapDataPlanes: nil,
      pixelsWide: size,
      pixelsHigh: size,
      bitsPerSample: 8,
      samplesPerPixel: 4,
      hasAlpha: true,
      isPlanar: false,
      colorSpaceName: .deviceRGB,
      bytesPerRow: 0,
      bitsPerPixel: 0,
    ),
    let context = NSGraphicsContext(bitmapImageRep: bitmap)
  else {
    throw NSError(
      domain: "noteDockIconGenerator",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "Unable to create bitmap: \(size)x\(size)"],
    )
  }

  bitmap.size = iconSize
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.imageInterpolation = .high

  NSColor.clear.setFill()
  canvasRect.fill()

  let roundedRect = NSBezierPath(
    roundedRect: iconRect,
    xRadius: radius,
    yRadius: radius,
  )

  NSGraphicsContext.saveGraphicsState()
  let shadow = NSShadow()
  shadow.shadowBlurRadius = CGFloat(size) * 0.022
  shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.12)
  shadow.shadowOffset = NSSize(width: 0, height: -CGFloat(size) * 0.01)
  shadow.set()
  NSColor.white.setFill()
  roundedRect.fill()
  NSGraphicsContext.restoreGraphicsState()

  NSGraphicsContext.saveGraphicsState()
  roundedRect.addClip()
  sourceImage.draw(
    in: iconRect,
    from: sourceRect,
    operation: .sourceOver,
    fraction: 1,
    respectFlipped: false,
    hints: [.interpolation: NSImageInterpolation.high],
  )
  NSGraphicsContext.restoreGraphicsState()

  NSColor(calibratedWhite: 0.82, alpha: 0.34).setStroke()
  roundedRect.lineWidth = max(1, CGFloat(size) * 0.0013)
  roundedRect.stroke()

  context.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()
  return bitmap
}

func writePNG(_ bitmap: NSBitmapImageRep, to url: URL) throws {
  guard
    let pngData = bitmap.representation(using: .png, properties: [:])
  else {
    throw NSError(
      domain: "noteDockIconGenerator",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "Unable to encode PNG: \(url.path)"],
    )
  }

  try pngData.write(to: url)
}

func runIconutil(iconsetURL: URL, outputURL: URL) throws {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
  process.arguments = ["-c", "icns", iconsetURL.path, "-o", outputURL.path]
  try process.run()
  process.waitUntilExit()

  if process.terminationStatus != 0 {
    throw NSError(
      domain: "noteDockIconGenerator",
      code: Int(process.terminationStatus),
      userInfo: [NSLocalizedDescriptionKey: "iconutil failed"],
    )
  }
}

let pngOutputs: [(Int, String)] = [
  (16, "icon-16.png"),
  (24, "icon-24.png"),
  (32, "icon-32.png"),
  (48, "icon-48.png"),
  (64, "icon-64.png"),
  (128, "icon-128.png"),
  (256, "icon-256.png"),
  (512, "icon.png"),
]

do {
  for (size, fileName) in pngOutputs {
    try writePNG(try makeIcon(size: size), to: resourcesURL.appendingPathComponent(fileName))
  }

  let iconsetURL = resourcesURL.appendingPathComponent("icon.iconset", isDirectory: true)
  try? fileManager.removeItem(at: iconsetURL)
  try fileManager.createDirectory(at: iconsetURL, withIntermediateDirectories: true)

  let iconsetOutputs: [(Int, String)] = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
  ]

  for (size, fileName) in iconsetOutputs {
    try writePNG(try makeIcon(size: size), to: iconsetURL.appendingPathComponent(fileName))
  }

  try runIconutil(
    iconsetURL: iconsetURL,
    outputURL: resourcesURL.appendingPathComponent("icon.icns"),
  )
  try? fileManager.removeItem(at: iconsetURL)

  print("Generated rounded macOS icons in \(resourcesURL.path)")
} catch {
  FileHandle.standardError.write(Data("Icon generation failed: \(error.localizedDescription)\n".utf8))
  exit(1)
}
