'use-strict'

// base libs
import PropTypes from 'prop-types'
import React, { Component } from 'react'
import {
  Platform,
  Dimensions,
  LayoutAnimation
} from 'react-native'
// map-related libs
import MapView from 'react-native-maps'
import SuperCluster from 'supercluster'
import GeoViewport from '@mapbox/geo-viewport'
// components / views
import ClusterMarker from './ClusterMarker'
// libs / utils
import {
  regionToBoundingBox,
  itemToGeoJSONFeature
} from './util'
import isEqual from 'lodash.isequal';

export default class ClusteredMapView extends Component {

  constructor(props) {
    super(props)

    this.state = {
      data: [], // helds renderable clusters and markers
      region: props.region || props.initialRegion, // helds current map region
    }

    this.isAndroid = Platform.OS === 'android'
    this.dimensions = [props.width, props.height]

    this.mapRef = this.mapRef.bind(this)
    this.onClusterPress = this.onClusterPress.bind(this)
    this.onRegionChangeComplete = this.onRegionChangeComplete.bind(this)
  }

  componentDidMount() {
    this.clusterize(this.props.data)
  }

  shouldComponentUpdate(nextProps, nextState)
  {
    const nextData = this.getClusters(nextState.region);
    return !isEqual(nextData, this.state.data) || this.props.children !== nextProps.children;
  }

  componentWillReceiveProps(nextProps) {
    if (!isEqual(this.props.data, nextProps.data))
    {
      this.clusterize(nextProps.data)
    }
    /*if (this.props.data !== nextProps.data)
      this.clusterize(nextProps.data)*/
  }

  componentWillUpdate(nextProps, nextState) {
    if (!this.isAndroid && this.props.animateClusters && this.clustersChanged(nextState))
      LayoutAnimation.configureNext(this.props.layoutAnimationConf)
  }

  mapRef = (ref) => {
    this.mapview = ref
  }

  getMapRef = () => this.mapview

  getClusteringEngine = () => this.index

  clusterize = (dataset) => {
    this.index = new SuperCluster({ // eslint-disable-line new-cap
      extent: this.props.extent,
      minZoom: this.props.minZoom,
      maxZoom: this.props.maxZoom,
      radius: this.props.radius || (this.dimensions[0] * .045), // 4.5% of screen width
    })

    // get formatted GeoPoints for cluster
    const rawData = dataset.map(itemToGeoJSONFeature)

    // load geopoints into SuperCluster
    this.index.load(rawData)

    const data = this.getClusters(this.state.region)
    this.setState({ data })
  }

  clustersChanged = (nextState) => this.state.data.length !== nextState.data.length

  onRegionChangeComplete = (region) => {
    const data = this.getClusters(region)

    if (!isEqual(data, this.state.data)) {
      return this.setState({ region, data }, () => {
        this.props.onRegionChangeComplete && this.props.onRegionChangeComplete(region, data)
      })
    }

    this.props.onRegionChangeComplete && this.props.onRegionChangeComplete(region, data)
  }

  getClusters = (region) => {
    const bbox = regionToBoundingBox(region),
          viewport = (region.longitudeDelta) >= 40 ? { zoom: this.props.minZoom } : GeoViewport.viewport(bbox, this.dimensions)

    return this.index.getClusters(bbox, viewport.zoom)
  }

  _onRegionChange = (region) =>
  {
    this.props.onRegionChange && this.props.onRegionChange(region)
  }

  onClusterPress = (cluster) => {

    // cluster press behavior might be extremely custom.
    //console.log("cluster Onpress start", this.props.preserveClusterPressBehavior);
    if (!this.props.preserveClusterPressBehavior) {
     // console.log("cluster Onpress start");
      this.props.onClusterPress && this.props.onClusterPress(cluster.properties.cluster_id)
      return
    }

    // //////////////////////////////////////////////////////////////////////////////////
    // NEW IMPLEMENTATION (with fitToCoordinates)
    // //////////////////////////////////////////////////////////////////////////////////
    // get cluster children
    //console.log("cluster Onpress fitToCoordinates");
    const children = this.index.getLeaves(cluster.properties.cluster_id, this.props.clusterPressMaxChildren),
          markers = children.map(c => c.properties.item)

    // fit right around them, considering edge padding
    this.mapview.fitToCoordinates(markers.map(m => m.location), { edgePadding: this.props.edgePadding })

    this.props.onClusterPress && this.props.onClusterPress(cluster.properties.cluster_id, markers)
  }

  render() {
    //console.log('renderMap');
    return (
      <MapView
        { ...this.props}
        ref={this.mapRef}
        onRegionChange={this._onRegionChange}
        onRegionChangeComplete={this.onRegionChangeComplete}>
        {
          this.props.clusteringEnabled && this.state.data.map((d) => {
            if (d.properties.point_count === 0)
              return this.props.renderMarker(d.properties.item)

            if(this.props.renderCluster)
            {
              //console.log('properties',d);


              const pointCount = d.properties.point_count // eslint-disable-line camelcase
              const latitude = d.geometry.coordinates[1],
                  longitude = d.geometry.coordinates[0]
                const cluster = {
                  pointCount,
                  coordinate: { latitude, longitude },
                  clusterId: d.properties.cluster_id,
                }/*
              return this.props.renderCluster({
                longitude: d.geometry.coordinates[0],
                latitude: d.geometry.coordinates[1],
                abos_count: 0,
                baskets_count: 1,
                id: d.properties.cluster_id,
              });*/
                return this.props.renderCluster(cluster)
            }

            return (
              <ClusterMarker
                {...d}
                onPress={this.onClusterPress}
                textStyle={this.props.textStyle}
                scaleUpRatio={this.props.scaleUpRatio}
                renderCluster={this.props.renderCluster}
                key={`cluster-${d.properties.cluster_id}`}
                containerStyle={this.props.containerStyle}
                clusterInitialFontSize={this.props.clusterInitialFontSize}
                clusterInitialDimension={this.props.clusterInitialDimension} />
            )
          })
        }
        {
          !this.props.clusteringEnabled && this.props.data.map(d => this.props.renderMarker(d))
        }
        {this.props.children}
      </MapView>
    )
  }
}

ClusteredMapView.defaultProps = {
  minZoom: 1,
  maxZoom: 20,
  extent: 512,
  textStyle: {},
  containerStyle: {},
  animateClusters: true,
  clusteringEnabled: true,
  clusterInitialFontSize: 12,
  clusterInitialDimension: 30,
  clusterPressMaxChildren: 100,
  preserveClusterPressBehavior: true,
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
  layoutAnimationConf: LayoutAnimation.Presets.spring,
  edgePadding: { top: 10, left: 10, right: 10, bottom: 10 }
}

ClusteredMapView.propTypes = {
  ...MapView.propTypes,
  // number
  radius: PropTypes.number,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  extent: PropTypes.number.isRequired,
  minZoom: PropTypes.number.isRequired,
  maxZoom: PropTypes.number.isRequired,
  clusterInitialFontSize: PropTypes.number.isRequired,
  clusterPressMaxChildren: PropTypes.number.isRequired,
  clusterInitialDimension: PropTypes.number.isRequired,
  // array
  data: PropTypes.array.isRequired,
  // func
  onExplode: PropTypes.func,
  onImplode: PropTypes.func,
  scaleUpRatio: PropTypes.func,
  renderCluster: PropTypes.func,
  onClusterPress: PropTypes.func,
  renderMarker: PropTypes.func.isRequired,
  // bool
  animateClusters: PropTypes.bool.isRequired,
  clusteringEnabled: PropTypes.bool.isRequired,
  preserveClusterPressBehavior: PropTypes.bool.isRequired,
  // object
  textStyle: PropTypes.object,
  containerStyle: PropTypes.object,
  layoutAnimationConf: PropTypes.object,
  edgePadding: PropTypes.object.isRequired,
  // string
}
