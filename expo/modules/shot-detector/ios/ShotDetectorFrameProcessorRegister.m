#import <Foundation/Foundation.h>
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import "shot_detector-Swift.h"

// Registers the "detectShots" frame processor plugin via ObjC +load.
// Swift forbids defining +load directly; this ObjC bridge is the standard workaround.
@interface ShotDetectorFrameProcessorRegister : NSObject
@end

@implementation ShotDetectorFrameProcessorRegister

+ (void)load {
  [FrameProcessorPluginRegistry addFrameProcessorPlugin:@"detectShots"
    withInitializer:^FrameProcessorPlugin * _Nonnull(VisionCameraProxyHolder * _Nonnull proxy,
                                                      NSDictionary * _Nullable options) {
      return [[ShotDetectorFrameProcessor alloc] initWithProxy:proxy withOptions:options];
    }];
}

@end
