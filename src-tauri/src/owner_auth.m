#import <Foundation/Foundation.h>
#import <LocalAuthentication/LocalAuthentication.h>
#import <string.h>

/**
 * thaali_owner_authenticate asks macOS to confirm the device owner (Touch ID, or the account
 * password where Touch ID is unavailable), showing `reason`. Returns 1 when confirmed, 0
 * otherwise with the system's message in `err`. Blocks until the owner answers, so it must not
 * run on the main thread.
 */
int thaali_owner_authenticate(const char *reason, char *err, size_t err_len) {
  LAContext *context = [LAContext new];
  NSError *policyError = nil;
  if (![context canEvaluatePolicy:LAPolicyDeviceOwnerAuthentication error:&policyError]) {
    snprintf(err, err_len, "%s", policyError.localizedDescription.UTF8String);
    return 0;
  }
  dispatch_semaphore_t done = dispatch_semaphore_create(0);
  __block BOOL confirmed = NO;
  __block NSString *message = nil;
  [context evaluatePolicy:LAPolicyDeviceOwnerAuthentication
          localizedReason:[NSString stringWithUTF8String:reason]
                    reply:^(BOOL success, NSError *error) {
                      confirmed = success;
                      message = error.localizedDescription;
                      dispatch_semaphore_signal(done);
                    }];
  dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
  if (!confirmed) {
    snprintf(err, err_len, "%s", message ? message.UTF8String : "Authentication failed");
  }
  return confirmed ? 1 : 0;
}
