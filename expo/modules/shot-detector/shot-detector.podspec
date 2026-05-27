require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'shot-detector'
  s.version        = package['version']
  s.summary        = package['description']
  s.homepage       = 'https://github.com/westari/ATHLT'
  s.license        = 'MIT'
  s.author         = 'ATHLT'
  s.source         = { :path => '.' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'

  # Both Swift files in ios/: ShotDetectorModule (Expo Module) + ShotDetectorFrameProcessor (VisionCamera plugin)
  s.source_files   = 'ios/**/*.{swift,h,m,mm,cpp}'

  # System frameworks used by CoreML inference and Vision pipeline
  s.frameworks     = 'CoreML', 'Vision', 'CoreMedia'

  # ExpoModulesCore: required by ShotDetectorModule (imports ExpoModulesCore)
  # VisionCamera: required by ShotDetectorFrameProcessor (imports VisionCamera, FrameProcessorPlugin)
  s.dependency 'ExpoModulesCore'
  s.dependency 'VisionCamera'
end
