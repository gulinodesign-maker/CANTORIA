class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func sceneDidBecomeActive(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = true
    }
    func sceneWillResignActive(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = false
    }
    func sceneDidEnterBackground(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = false
    }
    func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
        for context in contexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
