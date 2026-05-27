import { DeviceProvider } from './context/DeviceContext';
import { Device } from './components/Device';

export default function App() {
  return (
    <DeviceProvider>
      <Device />
    </DeviceProvider>
  );
}
