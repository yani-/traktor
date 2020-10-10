import WPressBrowser from '../components/wpress-browser.js'

export default function Index() {
    return (
        <div className="bg-gray-400">
            <WPressBrowser />
            <div className="fixed bottom-0 right-0 mb-6 mr-6">
                <a href="https://servmask.com/legal/terms" className="mx-5" target="_blank">Terms of Use</a>
                <a href="https://www.iubenda.com/privacy-policy/85375470" className="legal" target="_blank">Privacy Policy</a>
            </div>
        </div>
    )
}
