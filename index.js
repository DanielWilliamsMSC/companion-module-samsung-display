const tcp = require('../../tcp')
const instance_skel = require('../../instance_skel')

class instance extends instance_skel {
	/**
	 * Create an instance of the module
	 *
	 * @param {EventEmitter} system - the brains of the operation
	 * @param {string} id - the instance ID
	 * @param {Object} config - saved user configuration parameters
	 * @since 1.0.0
	 */
	constructor(system, id, config) {
		super(system, id, config)
		this.actions() // export actions
		this.init_presets() // export presets
	}

	updateConfig(config) {
		this.init_presets()

		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		this.config = config

		this.init_tcp()
	}

	init() {
		this.init_presets()
		this.init_tcp()
	}

	init_tcp() {
		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}

		this.status(this.STATE_WARNING, 'Connecting')

		if (this.config.host) {
			this.socket = new tcp(this.config.host, 1515)

			this.socket.on('status_change', (status, message) => {
				this.status(status, message)
			})

			this.socket.on('error', (err) => {
				this.debug('Network error', err)
				this.status(this.STATE_ERROR, err)
				this.log('error', 'Network error: ' + err.message)
			})

			this.socket.on('connect', () => {
				this.status(this.STATE_OK)
				this.debug('Connected')
			})

			this.socket.on('data', (data) => {
				// console.log(data)
				let powerOff = new Buffer.from([0xaa, 0xff, 0x01, 0x03, 0x41, 0x11, 0x00, 0x55], 'latin1')
				let powerOn = new Buffer.from([0xaa, 0xff, 0x01, 0x03, 0x41, 0x11, 0x01, 0x56], 'latin1')
				if(Buffer.compare(data, powerOff) === 0) {
					this.log('info', 'POWER OFF command received by Display')
				}
				if(Buffer.compare(data, powerOn) === 0) {
					this.log('info', 'POWER ON command received by Display')
				}
			})
		}
	}

	// Return config fields for web config
	config_fields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				regex: this.REGEX_IP,
			},
		]
	}

	// When module gets deleted
	destroy() {
		this.socket.destroy()

		this.debug('destroy', this.id)
	}

	init_presets() {
		let presets = []
		presets.push({
			category: 'Basics',
			label: 'Power on',
			bank: {
				style: 'text',
				text: `Power On`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
			},
			actions: [{ action: 'powerOn', options: [] }],
			feedbacks: [],
		})
		presets.push({
			category: 'Basics',
			label: 'Power off',
			bank: {
				style: 'text',
				text: `Power Off`,
				size: '14',
				color: this.rgb(255, 255, 255),
				bgcolor: this.rgb(0, 0, 0),
			},
			actions: [{ action: 'powerOff', options: [] }],
			feedbacks: [],
		})
		this.setPresetDefinitions(presets)
	}

	actions(system) {
		this.setActions({
			powerOn: {
				label: 'Power On Display',
				options: [],
			},
			powerOff: {
				label: 'Power Off Display',
				options: [],
			},
			inputHDMI1: {
				label: 'Set input to HDMI1',
				options: [],
			},
			inputHDMI2: {
				label: 'Set input to HDMI2',
				options: [],
			}
		})
	}

	action(action) {
		let cmd
		let end

		switch (action.action) {
			// response aa ff 01 03 41 11 01 56
			case 'powerOn':
				cmd = Buffer.from([
					'0xAA', //Header
					'0x11', //Command
					'0x01', //ID
					'0x01', //DataLength
					'0x01', //Data
					'0x14', //Checksum
					'0xAA', //Header
					'0x11', //Command
					'0xFE', //ID - 0xFE is a wildcard for the device to pass on to all others connected via serial
					'0x01', //DataLength
					'0x01', //Data - Power on = 1, Power off = 2
					'0x11', //Checksum
				], 'latin1')
				break
			case 'powerOff':
			// response  aa ff 01 03 41 11 00 55
				cmd = Buffer.from([
					'0xAA', //Header
					'0x11', //Command
					'0x01', //ID
					'0x01', //DataLength
					'0x00', //Data
					'0x13', //Checksum
					'0xAA', //Header
					'0x11', //Command
					'0xFE', //ID - 0xFE is a wildcard for the device to pass on to all others connected via serial
					'0x01', //DataLength
					'0x00', //Data - Power on = 1, Power off = 2
					'0x10', //Checksum
				], 'latin1')
				break
			case 'inputHDMI1':
			// response  aa ff 01 03 41 11 00 55
				cmd = Buffer.from([
					'0xAA', //Header
					'0x14', //Command
					'0x01', //ID
					'0x01', //DataLength
					'0x21', //Data
					'0x37', //Checksum
					'0xAA', //Header
					'0x14', //Command
					'0xFE', //ID - 0xFE is a wildcard for the device to pass on to all others connected via serial
					'0x01', //DataLength
					'0x21', //Data - HDMI1 = 0x21
					'0x34', //Checksum
				], 'latin1')
				break
			case 'inputHDMI2':
			// response  aa ff 01 03 41 11 00 55
				cmd = Buffer.from([
					'0xAA', //Header
					'0x14', //Command
					'0x01', //ID
					'0x01', //DataLength
					'0x23', //Data
					'0x39', //Checksum
					'0xAA', //Header
					'0x14', //Command
					'0xFE', //ID - 0xFE is a wildcard for the device to pass on to all others connected via serial
					'0x01', //DataLength
					'0x23', //Data - HDMI1 = 0x21
					'0x40', //Checksum
				], 'latin1')
				break
		}

		/*
		 * create a binary buffer pre-encoded 'latin1' (8bit no change bytes)
		 * sending a string assumes 'utf8' encoding
		 * which then escapes character values over 0x7F
		 * and destroys the 'binary' content
		 */
		// let sendBuf = Buffer.from(cmd + end, 'latin1')
		let sendBuf = cmd

		if (sendBuf != '') {
			this.debug('sending ', sendBuf, 'to', this.config.host)

			if (this.socket !== undefined && this.socket.connected) {
				this.socket.send(sendBuf)
			} else {
				this.debug('Socket not connected :(')
			}
		}
	}
}
exports = module.exports = instance
